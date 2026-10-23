import "server-only";
import { aliasedTable, and, asc, desc, eq, exists, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures, treeEdges } from "@/db/schema";
import type { YearStint } from "@/components/profile/linkYears";
import { treeEdgeYears } from "@/components/tree/years";
import { possessive } from "@/components/search/params";
import { CURRENT_SEASON } from "@/lib/brand";
import { levelShort, seasonSpans } from "@/lib/format";
import { escapeLike } from "./orgs";

/*
 * Search page queries (DESIGN.md §8.7). Extends lib/queries/search.ts (searchPeople, searchOrgs)
 * with what the page needs: multi-value checkbox facets with disjunctive counts, conference
 * abbreviations cleaned of source footnote markers ("SAA[m]" is the SAA), relevance ranking for the
 * query, programs with staff counts, and one line of structured tree context per person.
 */

export const SEARCH_PAGE_SIZE = 20;

/** Conference abbreviation without footnote markers left over from source tables ("NACC[g]" → "NACC"). */
const CONF = sql<string>`btrim(regexp_replace(${organizations.conferenceAbbr}, '\\[[^\\]]*\\]', '', 'g'))`;
/** Division as shown in chips and the URL: "NCAA D-III" → "D-III". */
const DIV = sql<string>`replace(${organizations.level}, 'NCAA ', '')`;
/** Head coaches first, then coordinators, position coaches, everyone else. */
const ROLE_ORDER = sql`case ${people.roleGroup} when 'head_coach' then 0 when 'coordinator' then 1 when 'position_coach' then 2 when 'ga_analyst' then 3 when 'support' then 4 else 5 end`;

export type PeopleCriteria = {
  q?: string;
  role?: string[];
  division?: string[];
  conference?: string[];
  state?: string[];
  workedAtOrgId?: string | null;
  workedUnderId?: string | null;
};

export type ProgramCriteria = Pick<PeopleCriteria, "q" | "division" | "conference" | "state">;

type Facet = "role" | "division" | "conference" | "state";

/**
 * The query as the data spells it: curly and modifier apostrophes (iOS Smart Punctuation types ’) and
 * backticks become the straight ' every name in the data uses ("O’Connor" finds O'Connor).
 */
export function normalizeQuery(q: string | undefined): string {
  return (q ?? "").replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'").trim();
}

function terms(q: string | undefined): string[] {
  return normalizeQuery(q).split(/\s+/).filter(Boolean).slice(0, 5);
}

/** A name column matched with apostrophes dropped on both sides ("OConnor" finds O'Connor). */
function looseLike(col: typeof people.fullName | typeof organizations.name | typeof organizations.shortName, term: string): SQL {
  return sql`replace(${col}, '''', '') ilike ${`%${escapeLike(term.replace(/'/g, ""))}%`}`;
}

function facetWhere(c: ProgramCriteria & { role?: string[] }, omit?: Facet): SQL[] {
  const w: SQL[] = [];
  if (omit !== "division" && c.division?.length) w.push(inArray(DIV, c.division));
  if (omit !== "conference" && c.conference?.length) w.push(inArray(CONF, c.conference));
  if (omit !== "state" && c.state?.length) w.push(inArray(organizations.state, c.state));
  if (omit !== "role" && c.role?.length) w.push(inArray(sql`${people.roleGroup}::text`, c.role));
  return w;
}

function peopleWhere(c: PeopleCriteria, omit?: Facet): SQL[] {
  const w = facetWhere(c, omit);
  const ts = terms(c.q);
  if (ts.length) {
    const perTerm = ts.map((t) => {
      const like = `%${escapeLike(t)}%`;
      return or(
        ilike(people.fullName, like),
        looseLike(people.fullName, t),
        ilike(people.currentTitle, like),
        ilike(organizations.shortName, like),
        ilike(organizations.name, like),
        looseLike(organizations.shortName, t),
        looseLike(organizations.name, t),
        ilike(organizations.nickname, like),
        sql`lower(${CONF}) = ${t.toLowerCase()}`,
      )!;
    });
    // "USA South" or "Empire 8" as a whole query matches the conference.
    w.push(or(and(...perTerm), sql`lower(${CONF}) = ${normalizeQuery(c.q).toLowerCase()}`)!);
  }
  if (c.workedAtOrgId) {
    w.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(tenures)
          .where(and(eq(tenures.personId, people.id), eq(tenures.orgId, c.workedAtOrgId), eq(tenures.asPlayer, false))),
      ),
    );
  }
  if (c.workedUnderId) {
    w.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(treeEdges)
          .where(and(eq(treeEdges.kind, "worked_under"), eq(treeEdges.mentorId, c.workedUnderId), eq(treeEdges.menteeId, people.id))),
      ),
    );
  }
  return w;
}

function programWhere(c: ProgramCriteria, omit?: Facet): SQL[] {
  const w: SQL[] = [eq(organizations.inRegistry, true), ...facetWhere(c, omit)];
  const ts = terms(c.q);
  if (ts.length) {
    const perTerm = ts.map((t) => {
      const like = `%${escapeLike(t)}%`;
      return or(
        ilike(organizations.name, like),
        ilike(organizations.shortName, like),
        looseLike(organizations.name, t),
        looseLike(organizations.shortName, t),
        ilike(organizations.nickname, like),
        sql`lower(${CONF}) = ${t.toLowerCase()}`,
      )!;
    });
    w.push(or(and(...perTerm), sql`lower(${CONF}) = ${normalizeQuery(c.q).toLowerCase()}`)!);
  }
  return w;
}

/* ---------- People ---------- */

export type PersonResult = {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  currentTitle: string | null;
  roleGroup: string | null;
  claimed: boolean;
  isDemo: boolean;
  /** Current program id (tree context leaves it out when the context is at the same program). */
  orgId: string | null;
  org: {
    slug: string;
    shortName: string;
    name: string;
    level: string | null;
    conference: string | null;
    inRegistry: boolean;
  } | null;
};

function firstNameOf(first: string | null, full: string): string {
  return first?.trim() || full.split(/\s+/)[0] || full;
}

export async function searchPeopleX(c: PeopleCriteria, page = 1): Promise<{ results: PersonResult[]; total: number }> {
  const where = and(...peopleWhere(c));
  const q = normalizeQuery(c.q);
  const e = escapeLike(q);
  // Same ranking idea as the global typeahead: exact name, name prefix, a later word of the name.
  const nameRank = q
    ? sql`case
        when lower(${people.fullName}) = ${q.toLowerCase()} then 0
        when ${people.fullName} ilike ${`${e}%`} then 1
        when ${people.fullName} ilike ${`% ${e}%`} or ${people.fullName} ilike ${`%-${e}%`} then 2
        else 3 end`
    : null;
  const order = [...(nameRank ? [nameRank] : []), ROLE_ORDER, asc(people.lastName), asc(people.fullName)];
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: people.id,
        slug: people.slug,
        fullName: people.fullName,
        firstName: people.firstName,
        currentTitle: people.currentTitle,
        roleGroup: people.roleGroup,
        claimed: people.claimed,
        isDemo: people.isDemo,
        orgId: people.currentOrgId,
        orgSlug: organizations.slug,
        orgShortName: organizations.shortName,
        orgName: organizations.name,
        orgLevel: organizations.level,
        orgConference: CONF,
        orgInRegistry: organizations.inRegistry,
      })
      .from(people)
      .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(where)
      .orderBy(...order)
      .limit(SEARCH_PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * SEARCH_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(people).leftJoin(organizations, eq(organizations.id, people.currentOrgId)).where(where),
  ]);
  return {
    total,
    results: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      fullName: r.fullName,
      firstName: firstNameOf(r.firstName, r.fullName),
      currentTitle: r.currentTitle,
      roleGroup: r.roleGroup,
      claimed: r.claimed,
      isDemo: r.isDemo,
      orgId: r.orgId,
      org: r.orgSlug
        ? { slug: r.orgSlug, shortName: r.orgShortName!, name: r.orgName!, level: r.orgLevel, conference: r.orgConference || null, inRegistry: !!r.orgInRegistry }
        : null,
    })),
  };
}

export async function countPeople(c: PeopleCriteria): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(...peopleWhere(c)));
  return n;
}

export type FacetCount = { value: string; count: number };
export type FacetCounts = Record<Facet, FacetCount[]>;

async function grouped(expr: SQL, base: "people" | "programs", where: SQL[]): Promise<FacetCount[]> {
  const q =
    base === "people"
      ? db.select({ value: sql<string>`${expr}`, count: sql<number>`count(*)::int` }).from(people).leftJoin(organizations, eq(organizations.id, people.currentOrgId))
      : db.select({ value: sql<string>`${expr}`, count: sql<number>`count(*)::int` }).from(organizations);
  const rows = await q.where(and(sql`${expr} is not null`, sql`${expr} <> ''`, ...where)).groupBy(expr);
  return rows.map((r) => ({ value: r.value, count: r.count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Facet counts where each facet ignores its own selection (so other values stay choosable). */
export async function peopleFacetCounts(c: PeopleCriteria): Promise<FacetCounts> {
  const [role, division, conference, state] = await Promise.all([
    grouped(sql`${people.roleGroup}::text`, "people", peopleWhere(c, "role")),
    grouped(DIV, "people", peopleWhere(c, "division")),
    grouped(CONF, "people", peopleWhere(c, "conference")),
    grouped(sql`${organizations.state}`, "people", peopleWhere(c, "state")),
  ]);
  return { role, division, conference, state };
}

export async function programFacetCounts(c: ProgramCriteria): Promise<FacetCounts> {
  const [division, conference, state] = await Promise.all([
    grouped(DIV, "programs", programWhere(c, "division")),
    grouped(CONF, "programs", programWhere(c, "conference")),
    grouped(sql`${organizations.state}`, "programs", programWhere(c, "state")),
  ]);
  return { role: [], division, conference, state };
}

/* ---------- Programs ---------- */

export type ProgramResult = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  nickname: string | null;
  city: string | null;
  state: string | null;
  level: string | null;
  conference: string | null;
  staff: number;
  alumni: number;
};

export async function searchProgramsX(c: ProgramCriteria, page = 1): Promise<{ results: ProgramResult[]; total: number }> {
  const where = and(...programWhere(c));
  const q = normalizeQuery(c.q);
  const lower = q.toLowerCase();
  const e = escapeLike(q);
  const rank = q
    ? sql`case
        when lower(${organizations.shortName}) = ${lower} or lower(${organizations.name}) = ${lower} then 0
        when ${organizations.name} ilike ${`${e}%`} or ${organizations.shortName} ilike ${`${e}%`} then 1
        when ${organizations.name} ilike ${`% ${e}%`} or ${organizations.shortName} ilike ${`% ${e}%`} then 2
        else 3 end`
    : null;
  const order = [...(rank ? [rank] : []), asc(organizations.shortName)];
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        shortName: organizations.shortName,
        nickname: organizations.nickname,
        city: organizations.city,
        state: organizations.state,
        level: organizations.level,
        conference: CONF,
      })
      .from(organizations)
      .where(where)
      .orderBy(...order)
      .limit(SEARCH_PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * SEARCH_PAGE_SIZE),
    db.select({ total: sql<number>`count(*)::int` }).from(organizations).where(where),
  ]);
  const ids = rows.map((r) => r.id);
  const [staff, alumni] = ids.length
    ? await Promise.all([
        db
          .select({ orgId: people.currentOrgId, n: sql<number>`count(*)::int` })
          .from(people)
          .where(inArray(people.currentOrgId, ids))
          .groupBy(people.currentOrgId),
        db
          .select({ orgId: tenures.orgId, n: sql<number>`count(distinct ${tenures.personId})::int` })
          .from(tenures)
          .innerJoin(people, eq(people.id, tenures.personId))
          .where(
            and(
              inArray(tenures.orgId, ids),
              eq(tenures.asPlayer, false),
              eq(tenures.isCurrent, false),
              or(sql`${people.currentOrgId} is null`, ne(people.currentOrgId, tenures.orgId)),
            ),
          )
          .groupBy(tenures.orgId),
      ])
    : [[], []];
  const staffBy = new Map(staff.map((s) => [s.orgId, s.n]));
  const alumniBy = new Map(alumni.map((a) => [a.orgId, a.n]));
  return {
    total,
    results: rows.map((r) => ({ ...r, conference: r.conference || null, staff: staffBy.get(r.id) ?? 0, alumni: alumniBy.get(r.id) ?? 0 })),
  };
}

export async function countPrograms(c: ProgramCriteria): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(organizations).where(and(...programWhere(c)));
  return n;
}

/**
 * Full conference names for chip titles, keyed by the cleaned football abbreviation. The source's
 * `conference` column is each school's all-sports conference, so a name is taken only when the
 * programs agree on it: the most common name, the shared words of tied names ("Middle Atlantic
 * Conference Freedom" and "... Commonwealth" → "Middle Atlantic Conference"), and "Independent" for
 * football independents (Keystone lists the United East Conference, which contradicts its abbreviation).
 */
export async function conferenceNames(): Promise<Record<string, string>> {
  const rows = await db
    .select({ abbr: CONF, name: organizations.conference, n: sql<number>`count(*)::int` })
    .from(organizations)
    .where(and(eq(organizations.inRegistry, true), sql`${organizations.conferenceAbbr} is not null`))
    .groupBy(CONF, organizations.conference);
  const byAbbr = new Map<string, { name: string; n: number }[]>();
  for (const r of rows) {
    if (!r.abbr) continue;
    const list = byAbbr.get(r.abbr) ?? [];
    if (r.name) list.push({ name: r.name, n: r.n });
    byAbbr.set(r.abbr, list);
  }
  const out: Record<string, string> = {};
  for (const [abbr, names] of byAbbr) out[abbr] = conferenceName(abbr, names);
  return out;
}

function conferenceName(abbr: string, names: { name: string; n: number }[]): string {
  if (/^independents?$/i.test(abbr)) return "Independent";
  const top = Math.max(0, ...names.map((x) => x.n));
  const tied = names.filter((x) => x.n === top).map((x) => x.name).sort();
  if (!tied.length) return abbr;
  if (tied.length === 1) return tied[0];
  // Tied names: their shared leading words when that is still a name, else the abbreviation.
  const words = tied.map((t) => t.split(/\s+/));
  const shared: string[] = [];
  for (let i = 0; i < words[0].length && words.every((w) => w[i] === words[0][i]); i++) shared.push(words[0][i]);
  return shared.length >= 2 ? shared.join(" ") : abbr;
}

/** Divisions as the URL and chips write them ("D-III"), from the registry. */
export async function divisionValues(): Promise<string[]> {
  const rows = await db.selectDistinct({ d: DIV }).from(organizations).where(and(eq(organizations.inRegistry, true), sql`${organizations.level} is not null`));
  return rows.map((r) => r.d).filter(Boolean);
}

/* ---------- Worked at / worked under ---------- */

export type OrgRef = { id: string; slug: string; shortName: string; name: string; level: string | null; conference: string | null; inRegistry: boolean };
export type PersonRef = {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  currentTitle: string | null;
  orgShortName: string | null;
  /** People listed as having worked under this coach (the "Worked under" filter's reach). */
  mentees: number;
  /** Whether any of the coach's own stints is a head coaching role. */
  wasHeadCoach: boolean;
};

const orgRefCols = {
  id: organizations.id,
  slug: organizations.slug,
  shortName: organizations.shortName,
  name: organizations.name,
  level: organizations.level,
  conference: CONF,
  inRegistry: organizations.inRegistry,
};

/** A program by slug, or by id ("ncaa-2751") for links built from ids. */
export async function getOrgRef(slug: string): Promise<OrgRef | null> {
  const [row] = await db
    .select(orgRefCols)
    .from(organizations)
    .where(or(eq(organizations.slug, slug), eq(organizations.id, slug)))
    .orderBy(sql`case when ${organizations.slug} = ${slug} then 0 else 1 end`)
    .limit(1);
  return row ? { ...row, conference: row.conference || null } : null;
}

/** Free text from the no-JS "Worked at" field: registry programs first, then any organization. */
export async function findOrgByText(text: string): Promise<OrgRef | null> {
  const t = text.trim();
  if (t.length < 2) return null;
  const lower = t.toLowerCase();
  const e = escapeLike(t);
  const [row] = await db
    .select(orgRefCols)
    .from(organizations)
    .where(or(ilike(organizations.name, `%${e}%`), ilike(organizations.shortName, `%${e}%`), ilike(organizations.nickname, `%${e}%`)))
    .orderBy(
      sql`case when lower(${organizations.shortName}) = ${lower} or lower(${organizations.name}) = ${lower} then 0 when ${organizations.shortName} ilike ${`${e}%`} or ${organizations.name} ilike ${`${e}%`} then 1 else 2 end`,
      desc(organizations.inRegistry),
      asc(organizations.shortName),
    )
    .limit(1);
  return row ? { ...row, conference: row.conference || null } : null;
}

/** People who worked under this coach (distinct mentees of their worked_under edges). Qualified by hand: see searchTotals. */
const MENTEES = sql<number>`(select count(distinct te.mentee_id)::int from tree_edges te where te.kind = 'worked_under' and te.mentor_id = "people"."id")`;
const WAS_HEAD = sql<boolean>`exists (select 1 from tenures ht where ht.person_id = "people"."id" and ht.role_group = 'head_coach' and ht.as_player = false)`;

const personRefCols = {
  id: people.id,
  slug: people.slug,
  fullName: people.fullName,
  firstName: people.firstName,
  currentTitle: people.currentTitle,
  orgShortName: organizations.shortName,
  mentees: MENTEES,
  wasHeadCoach: WAS_HEAD,
};

/** A coach by slug, or by id ("p-ian-falconer"). */
export async function getPersonRef(slug: string): Promise<PersonRef | null> {
  const [row] = await db
    .select(personRefCols)
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(or(eq(people.slug, slug), eq(people.id, slug)))
    .orderBy(sql`case when ${people.slug} = ${slug} then 0 else 1 end`)
    .limit(1);
  return row ? { ...row, firstName: firstNameOf(row.firstName, row.fullName) } : null;
}

/** Name ranking shared by the "Worked under" lookups: exact name, prefix, a later word, anything else. */
function personNameRank(t: string): SQL {
  const e = escapeLike(t);
  return sql`case
    when lower(${people.fullName}) = ${t.toLowerCase()} then 0
    when ${people.fullName} ilike ${`${e}%`} then 1
    when ${people.fullName} ilike ${`% ${e}%`} or ${people.fullName} ilike ${`%-${e}%`} then 2
    else 3 end`;
}

function personTextWhere(t: string): SQL {
  return and(...terms(t).map((w) => or(ilike(people.fullName, `%${escapeLike(w)}%`), looseLike(people.fullName, w))!))!;
}

/** Free text from the no-JS "Worked under" field: exact name, then prefix, then coaches with the biggest trees. */
export async function findPersonByText(text: string): Promise<PersonRef | null> {
  const t = normalizeQuery(text);
  if (t.length < 2) return null;
  const [row] = await db
    .select(personRefCols)
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(personTextWhere(t))
    .orderBy(personNameRank(t), sql`${MENTEES} desc`, asc(people.fullName))
    .limit(1);
  return row ? { ...row, firstName: firstNameOf(row.firstName, row.fullName) } : null;
}

export type PickerCoach = { slug: string; name: string; meta: string | null };

/**
 * "Worked under" picker options: the closest name match first, then coaches with the most people
 * under them, so a pick usually has a tree to list. The meta leads with the program (it survives
 * truncation in the 232px rail), then how many coached under them, or the title when no one did.
 */
export async function pickerCoaches(text: string, limit = 8): Promise<PickerCoach[]> {
  const t = normalizeQuery(text);
  if (t.length < 2 || !terms(t).length) return [];
  const rows = await db
    .select(personRefCols)
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(personTextWhere(t))
    .orderBy(personNameRank(t), sql`${MENTEES} desc`, asc(people.lastName), asc(people.fullName))
    .limit(limit);
  return rows.map((r) => {
    const first = firstNameOf(r.firstName, r.fullName);
    const reach = r.mentees > 0 ? `${r.mentees.toLocaleString("en-US")} coached under ${first}` : r.currentTitle;
    return { slug: r.slug, name: r.fullName, meta: [r.orgShortName, reach].filter(Boolean).join(" · ") || null };
  });
}

/* ---------- Tree context ---------- */

/** One shown year, flagged when the stint it comes from has yearsExplicit = false (§6.2). */
export type YearMark = { year: number; inferred: boolean; reason: string | null };

/**
 * One run of seasons as the source pins it. Ongoing runs have no end; their start is null when the
 * source doesn't say since when (an undated current stint pins no start year, never "2026–"). A past
 * run has both bounds or neither (years not in source).
 */
export type Run = { ongoing: boolean; start: YearMark | null; end: YearMark | null };

/**
 * `joined`: the row's coach started at that program this season (CURRENT_SEASON, a stated or inferred
 * start, not an undated current role), so an ongoing line reads "Joined Ian's staff in 2026" rather
 * than "since 2026". A run that starts this season only because the other coach arrived keeps "since".
 */
export type TreeContext =
  | { kind: "workedUnder"; mentorName: string; mentorFirst: string; mentorSlug: string; org: string; atCurrent: boolean; runs: Run[]; joined: boolean }
  /**
   * Own stints at one program. `runs` are the shown runs; `roles` counts the distinct roles in the
   * shown run when several back-to-back roles merge into one span ("ST Coord. / LB, 2022–24 · 2 roles");
   * `stints` counts separate runs (split by a gap).
   */
  | { kind: "workedAt"; org: string; atCurrent: boolean; role: string | null; current: boolean; runs: Run[]; stints: number; roles: number; joined: boolean }
  | { kind: "viewer"; relation: "mentor" | "mentee" | "peer"; org: string; atCurrent: boolean; runs: Run[]; joined: boolean }
  | { kind: "mentees"; count: number };

export type ContextPerson = { id: string; fullName: string; currentOrgId: string | null };

type CtxEdge = {
  kind: "worked_under" | "worked_alongside";
  mentorId: string;
  menteeId: string;
  orgId: string;
  org: string;
  startYear: number | null;
  endYear: number | null;
  mentorName: string;
  mentorFirstName: string | null;
  mentorSlug: string;
};

const ctxOrg = aliasedTable(organizations, "ctx_org");
const ctxMentor = aliasedTable(people, "ctx_mentor");

const ctxEdgeCols = {
  kind: treeEdges.kind,
  mentorId: treeEdges.mentorId,
  menteeId: treeEdges.menteeId,
  orgId: treeEdges.orgId,
  org: ctxOrg.shortName,
  startYear: treeEdges.startYear,
  endYear: treeEdges.endYear,
  mentorName: ctxMentor.fullName,
  mentorFirstName: ctxMentor.firstName,
  mentorSlug: ctxMentor.slug,
};

function ctxEdges(where: SQL | undefined): Promise<CtxEdge[]> {
  return db
    .select(ctxEdgeCols)
    .from(treeEdges)
    .innerJoin(ctxOrg, eq(ctxOrg.id, treeEdges.orgId))
    .innerJoin(ctxMentor, eq(ctxMentor.id, treeEdges.mentorId))
    .where(where);
}

/** Every stint of these people at these organizations, as the tree's year rules read them. */
async function ctxStints(personIds: string[], orgIds: string[]): Promise<YearStint[]> {
  if (!personIds.length || !orgIds.length) return [];
  return db
    .select({
      personId: tenures.personId,
      orgId: tenures.orgId,
      roleGroup: sql<string>`${tenures.roleGroup}::text`,
      sport: tenures.sport,
      startYear: tenures.startYear,
      endYear: tenures.endYear,
      isCurrent: tenures.isCurrent,
      asPlayer: tenures.asPlayer,
      yearsExplicit: tenures.yearsExplicit,
      evidence: tenures.evidence,
    })
    .from(tenures)
    .where(and(inArray(tenures.personId, [...new Set(personIds)]), inArray(tenures.orgId, [...new Set(orgIds)])));
}

/** The tooltip reason under a dotted year (§6.2), worded as on the profile tree: whose bio, quoting it. */
function reasonFrom(personId: string, evidence: string | null, names: Map<string, string>): string {
  const who = names.get(personId);
  const bio = who ? `${possessive(who)} staff bio` : "the staff bio";
  if (!evidence) return `from ${bio}, not stated in it`;
  const q = evidence.trim().replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "");
  return `from ${bio}, which says “${q.length > 160 ? `${q.slice(0, 157).trimEnd()}…` : q}”`;
}

/**
 * One stored edge as the source pins it: the same per-bound rules as the profile tree and the tree
 * explorer (components/tree/years.ts). Only the bound whose stint is inferred is dotted; an undated
 * current stint pins no start year.
 */
function edgeRun(e: CtxEdge, stints: YearStint[], names: Map<string, string>): Run {
  const y = treeEdgeYears({ kind: e.kind, mentorId: e.mentorId, menteeId: e.menteeId, orgId: e.orgId, startYear: e.startYear, endYear: e.endYear }, stints);
  const startFrom = y.startInferred ? y.inferredFrom[0] : undefined;
  const endFrom = y.endInferred ? y.inferredFrom[y.startInferred ? 1 : 0] : undefined;
  const mark = (year: number | null, inferred: boolean, from: { personId: string; evidence: string | null } | undefined): YearMark | null =>
    year == null ? null : { year, inferred, reason: inferred && from ? reasonFrom(from.personId, from.evidence, names) : null };
  return {
    ongoing: y.ongoing,
    start: mark(y.startYear, y.startInferred, startFrom),
    end: y.ongoing ? null : mark(y.endYear, y.endInferred, endFrom),
  };
}

const edgeLast = (e: CtxEdge) => e.endYear ?? e.startYear ?? 0;
const byRecency = (a: CtxEdge, b: CtxEdge) => edgeLast(b) - edgeLast(a) || (b.startYear ?? 0) - (a.startYear ?? 0);
const byStart = (a: CtxEdge, b: CtxEdge) => (a.startYear ?? edgeLast(a)) - (b.startYear ?? edgeLast(b));

/** The most recent edge, plus every edge of the same pair and kind at the same organization (oldest first). */
function sameRun(edges: CtxEdge[], pool: CtxEdge[] = edges): { latest: CtxEdge; group: CtxEdge[] } | null {
  const latest = [...pool].sort(byRecency)[0];
  if (!latest) return null;
  const group = edges.filter((e) => e.kind === latest.kind && e.mentorId === latest.mentorId && e.menteeId === latest.menteeId && e.orgId === latest.orgId).sort(byStart);
  return { latest, group };
}

/* Worked at: a person's own stints at one program, kept apart (never one span across a gap). */

type OwnStint = { personId: string; role: string; startYear: number | null; endYear: number | null; isCurrent: boolean; yearsExplicit: boolean; evidence: string | null };

/** A start year shown for a run of stints: dotted only when no stint that starts the run states it. */
function startMark(stints: OwnStint[], year: number, names: Map<string, string>): YearMark {
  const from = stints.filter((t) => t.startYear === year || (t.startYear == null && !t.isCurrent && t.endYear === year));
  const inf = from.some((t) => t.yearsExplicit) ? null : (from.find((t) => !t.yearsExplicit) ?? null);
  return { year, inferred: !!inf, reason: inf ? reasonFrom(inf.personId, inf.evidence, names) : null };
}

/** An end year shown for a past run: dotted only when no stint that ends the run states it. */
function endMark(stints: OwnStint[], year: number, names: Map<string, string>): YearMark {
  const from = stints.filter((t) => !t.isCurrent && (t.endYear ?? t.startYear) === year);
  const inf = from.some((t) => t.yearsExplicit) ? null : (from.find((t) => !t.yearsExplicit) ?? null);
  return { year, inferred: !!inf, reason: inf ? reasonFrom(inf.personId, inf.evidence, names) : null };
}

const normRole = (r: string) => r.trim().toLowerCase().replace(/\s+/g, " ");

/** The seasons one stint accounts for, by the same rules as seasonSpans (null: an undated past stint). */
function stintCover(t: OwnStint): [number, number] | null {
  if (t.startYear) return [t.startYear, t.isCurrent ? CURRENT_SEASON : Math.max(t.startYear, t.endYear ?? t.startYear)];
  if (t.isCurrent) return [CURRENT_SEASON, CURRENT_SEASON];
  if (t.endYear) return [t.endYear, t.endYear];
  return null;
}

/** Whether a set of stints at one program has a current run that starts this season with a known start. */
function joinedThisSeason(stints: { startYear: number | null; endYear: number | null; isCurrent: boolean }[]): boolean {
  const span = seasonSpans(stints).find((s) => s.isCurrent);
  return !!span && !span.undatedCurrent && span.start === CURRENT_SEASON;
}

function workedAtContext(mine: OwnStint[], org: string, atCurrent: boolean, names: Map<string, string>): TreeContext {
  const spans = seasonSpans(mine);
  const current = mine.some((t) => t.isCurrent);
  const spanRun = (s: (typeof spans)[number], ongoing: boolean): Run => ({
    ongoing,
    start: s.undatedCurrent ? null : startMark(mine, s.start, names),
    end: ongoing ? null : endMark(mine, s.end, names),
  });
  const base = { kind: "workedAt" as const, org, atCurrent, stints: spans.length, roles: 1, joined: false };
  if (current) {
    const span = spans.find((s) => s.isCurrent);
    return { ...base, role: null, current: true, runs: span ? [spanRun(span, true)] : [{ ongoing: true, start: null, end: null }], joined: joinedThisSeason(mine) };
  }
  const dated = mine.filter((t) => t.startYear != null || t.endYear != null);
  if (!dated.length) return { ...base, role: mine[0]?.role ?? null, current: false, runs: [], stints: 0 };
  const roles = new Set(dated.map((t) => normRole(t.role)));
  if (roles.size === 1) {
    // One role throughout: every run with its own years ("Cornerbacks, 2022, 2024").
    return { ...base, role: dated[0].role, current: false, runs: spans.map((s) => spanRun(s, false)) };
  }
  // Several roles: the latest role over the whole run it belongs to. Back-to-back roles merge into one
  // span ("ST Coord. / LB, 2022–24 · 2 roles"), so the years are the coach's time at the program; a run
  // split off by a gap stays apart ("· 2 stints").
  const last = (t: OwnStint) => Math.max(t.startYear ?? 0, t.endYear ?? 0);
  const latest = [...dated].sort((a, b) => last(b) - last(a) || (b.startYear ?? 0) - (a.startYear ?? 0))[0];
  const lc = stintCover(latest)!;
  const span = spans.find((x) => x.start <= lc[0] && lc[1] <= x.end) ?? { start: lc[0], end: lc[1], isCurrent: false, undatedCurrent: false };
  const inSpan = dated.filter((t) => {
    const c = stintCover(t);
    return !!c && span.start <= c[0] && c[1] <= span.end;
  });
  return {
    ...base,
    role: latest.role,
    current: false,
    runs: [{ ongoing: false, start: startMark(inSpan, span.start, names), end: endMark(inSpan, span.end, names) }],
    roles: new Set(inSpan.map((t) => normRole(t.role))).size,
  };
}

/** Whether this coach's own coaching stints at the program start a current run this season. */
function joinedAt(stints: YearStint[], personId: string, orgId: string): boolean {
  return joinedThisSeason(stints.filter((t) => t.personId === personId && t.orgId === orgId && !t.asPlayer && t.sport === "football"));
}

/**
 * One line of tree context per person (DESIGN.md §8.7). With a "Worked under" filter: the person's runs
 * under that coach. With "Worked at": their own stints at that program. Otherwise: the viewer's own
 * relationship, then the size of the coach's tree, then the most recent coach they worked under,
 * preferring one at another program (the current head coach is already implied by the title line).
 */
export async function treeContexts(
  list: ContextPerson[],
  opts: { workedAtOrgId?: string | null; workedUnderId?: string | null; viewerPersonId?: string | null },
): Promise<Map<string, TreeContext>> {
  const out = new Map<string, TreeContext>();
  if (!list.length) return out;
  const ids = list.map((p) => p.id);
  const byId = new Map(list.map((p) => [p.id, p]));
  const names = new Map(list.map((p) => [p.id, p.fullName]));
  const atCurrent = (personId: string, orgId: string) => byId.get(personId)?.currentOrgId === orgId;

  if (opts.workedUnderId) {
    const edges = await ctxEdges(and(eq(treeEdges.kind, "worked_under"), eq(treeEdges.mentorId, opts.workedUnderId), inArray(treeEdges.menteeId, ids)));
    const stints = await ctxStints([opts.workedUnderId, ...ids], edges.map((e) => e.orgId));
    for (const e of edges) names.set(e.mentorId, e.mentorName);
    for (const id of ids) {
      const picked = sameRun(edges.filter((e) => e.menteeId === id));
      if (!picked) continue;
      const { latest, group } = picked;
      out.set(id, {
        kind: "workedUnder",
        mentorName: latest.mentorName,
        mentorFirst: firstNameOf(latest.mentorFirstName, latest.mentorName),
        mentorSlug: latest.mentorSlug,
        org: latest.org,
        atCurrent: atCurrent(id, latest.orgId),
        runs: group.map((e) => edgeRun(e, stints, names)),
        joined: joinedAt(stints, id, latest.orgId),
      });
    }
    return out;
  }

  if (opts.workedAtOrgId) {
    const rows = await db
      .select({
        personId: tenures.personId,
        role: tenures.role,
        startYear: tenures.startYear,
        endYear: tenures.endYear,
        isCurrent: tenures.isCurrent,
        yearsExplicit: tenures.yearsExplicit,
        evidence: tenures.evidence,
        org: organizations.shortName,
      })
      .from(tenures)
      .innerJoin(organizations, eq(organizations.id, tenures.orgId))
      .where(and(eq(tenures.orgId, opts.workedAtOrgId), eq(tenures.asPlayer, false), inArray(tenures.personId, ids)));
    for (const id of ids) {
      const mine = rows.filter((r) => r.personId === id);
      if (mine.length) out.set(id, workedAtContext(mine, mine[0].org, atCurrent(id, opts.workedAtOrgId), names));
    }
    return out;
  }

  const viewerId = opts.viewerPersonId ?? null;
  const [viewerEdges, menteeRows, mentorEdges] = await Promise.all([
    viewerId
      ? ctxEdges(or(and(eq(treeEdges.mentorId, viewerId), inArray(treeEdges.menteeId, ids)), and(eq(treeEdges.menteeId, viewerId), inArray(treeEdges.mentorId, ids))))
      : Promise.resolve([] as CtxEdge[]),
    db
      .select({ personId: treeEdges.mentorId, n: sql<number>`count(distinct ${treeEdges.menteeId})::int` })
      .from(treeEdges)
      .where(and(eq(treeEdges.kind, "worked_under"), inArray(treeEdges.mentorId, ids)))
      .groupBy(treeEdges.mentorId),
    ctxEdges(and(eq(treeEdges.kind, "worked_under"), inArray(treeEdges.menteeId, ids))),
  ]);

  type Pick = { personId: string; latest: CtxEdge; group: CtxEdge[]; viewer: boolean };
  const picks: Pick[] = [];
  const taken = new Set<string>();
  if (viewerId) {
    for (const id of ids) {
      if (id === viewerId) continue;
      const picked = sameRun(viewerEdges.filter((e) => (e.mentorId === id && e.menteeId === viewerId) || (e.menteeId === id && e.mentorId === viewerId)));
      if (picked) {
        picks.push({ personId: id, ...picked, viewer: true });
        taken.add(id);
      }
    }
  }
  const menteeCount = new Map(menteeRows.map((r) => [r.personId, r.n]));
  for (const id of ids) {
    if (taken.has(id)) continue;
    const n = menteeCount.get(id) ?? 0;
    if (n > 0) {
      out.set(id, { kind: "mentees", count: n });
      taken.add(id);
      continue;
    }
    const mine = mentorEdges.filter((e) => e.menteeId === id);
    const away = mine.filter((e) => e.orgId !== byId.get(id)?.currentOrgId);
    const picked = sameRun(mine, away.length ? away : mine);
    if (picked) picks.push({ personId: id, ...picked, viewer: false });
  }
  if (!picks.length) return out;

  for (const p of picks) for (const e of p.group) names.set(e.mentorId, e.mentorName);
  if (viewerId) {
    const [v] = await db.select({ fullName: people.fullName }).from(people).where(eq(people.id, viewerId)).limit(1);
    if (v) names.set(viewerId, v.fullName);
  }
  const stints = await ctxStints(
    picks.flatMap((p) => [p.latest.mentorId, p.latest.menteeId]),
    picks.map((p) => p.latest.orgId),
  );
  for (const { personId, latest, group, viewer } of picks) {
    const runs = group.map((e) => edgeRun(e, stints, names));
    const here = atCurrent(personId, latest.orgId);
    const joined = joinedAt(stints, personId, latest.orgId);
    if (viewer) {
      const relation = latest.kind === "worked_alongside" ? "peer" : latest.mentorId === viewerId ? "mentee" : "mentor";
      out.set(personId, { kind: "viewer", relation, org: latest.org, atCurrent: here, runs, joined });
    } else {
      out.set(personId, {
        kind: "workedUnder",
        mentorName: latest.mentorName,
        mentorFirst: firstNameOf(latest.mentorFirstName, latest.mentorName),
        mentorSlug: latest.mentorSlug,
        org: latest.org,
        atCurrent: here,
        runs,
        joined,
      });
    }
  }
  return out;
}

/* ---------- No-query state ---------- */

export type SearchTotals = {
  /** Everyone search lists (the unfiltered People count), demo profiles included. */
  people: number;
  /** Coaches read from public staff pages (people minus demo profiles). */
  sourced: number;
  demo: number;
  /** Division III programs in the registry. */
  programs: number;
  /** Registry programs whose staff page was read (at least one coach lists it as the current program). */
  programsRead: number;
};

export async function searchTotals(): Promise<SearchTotals> {
  const [[p], [o]] = await Promise.all([
    db.select({ all: sql<number>`count(*)::int`, demo: sql<number>`count(*) filter (where ${people.isDemo})::int` }).from(people),
    db
      .select({
        all: sql<number>`count(*)::int`,
        // Qualified by hand: drizzle drops table names in a single-table select, and "id" would bind to people.
        read: sql<number>`count(*) filter (where exists (select 1 from people p where p.current_org_id = "organizations"."id" and not p.is_demo))::int`,
      })
      .from(organizations)
      .where(eq(organizations.inRegistry, true)),
  ]);
  return { people: p.all, sourced: p.all - p.demo, demo: p.demo, programs: o.all, programsRead: o.read };
}

export type PickerOrg = { slug: string; name: string; shortName: string; meta: string | null };

/**
 * "Worked at" picker options: every organization with a coaching stint (D-I, D-II, junior colleges,
 * high schools, closed programs), not only the registry. Registry programs first, then the closest
 * name match, then the most coaches. The meta says how many coaches have a stint there.
 */
export async function pickerOrgs(text: string, limit = 8): Promise<PickerOrg[]> {
  const ts = terms(text);
  if (text.trim().length < 2 || !ts.length) return [];
  const q = text.trim();
  const e = escapeLike(q);
  // Qualified by hand: drizzle drops table names in a single-table select ("id" would bind to tenures).
  const coaches = sql<number>`(select count(distinct t.person_id)::int from tenures t where t.org_id = "organizations"."id" and t.as_player = false)`;
  const rows = await db
    .select({ ...orgRefCols, coaches })
    .from(organizations)
    .where(
      and(
        ...ts.map((t) => {
          const like = `%${escapeLike(t)}%`;
          return or(ilike(organizations.name, like), ilike(organizations.shortName, like), ilike(organizations.nickname, like))!;
        }),
        or(eq(organizations.inRegistry, true), sql`${coaches} > 0`),
      ),
    )
    .orderBy(
      desc(organizations.inRegistry),
      sql`case
        when lower(${organizations.shortName}) = ${q.toLowerCase()} or lower(${organizations.name}) = ${q.toLowerCase()} then 0
        when ${organizations.shortName} ilike ${`${e}%`} or ${organizations.name} ilike ${`${e}%`} then 1
        when ${organizations.shortName} ilike ${`% ${e}%`} or ${organizations.name} ilike ${`% ${e}%`} then 2
        else 3 end`,
      sql`${coaches} desc`,
      asc(organizations.shortName),
    )
    .limit(limit);
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    shortName: r.shortName,
    meta: [levelShort(r.level), r.conference || null, r.coaches > 0 ? `${r.coaches.toLocaleString("en-US")} ${r.coaches === 1 ? "coach" : "coaches"}` : null].filter(Boolean).join(" · ") || null,
  }));
}

/** The coach with the most people who worked under them (a popular "Worked under" search). */
export async function biggestTree(): Promise<(PersonRef & { mentees: number }) | null> {
  const [row] = await db
    .select({ ...personRefCols, mentees: sql<number>`count(distinct ${treeEdges.menteeId})::int` })
    .from(treeEdges)
    .innerJoin(people, eq(people.id, treeEdges.mentorId))
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(treeEdges.kind, "worked_under"), eq(people.roleGroup, "head_coach")))
    .groupBy(people.id, organizations.shortName)
    .orderBy(desc(sql`count(distinct ${treeEdges.menteeId})`), asc(people.fullName))
    .limit(1);
  return row ? { ...row, firstName: firstNameOf(row.firstName, row.fullName) } : null;
}

/** The viewer's program, its conference and head coach, for personal popular searches. */
export async function viewerContext(orgId: string, viewerPersonId: string | null) {
  const [org] = await db.select(orgRefCols).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return null;
  const [hc] = await db
    .select(personRefCols)
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(people.currentOrgId, orgId), eq(people.roleGroup, "head_coach"), viewerPersonId ? ne(people.id, viewerPersonId) : undefined))
    .orderBy(asc(people.fullName))
    .limit(1);
  return {
    org: { ...org, conference: org.conference || null },
    headCoach: hc ? { ...hc, firstName: firstNameOf(hc.firstName, hc.fullName) } : null,
  };
}
