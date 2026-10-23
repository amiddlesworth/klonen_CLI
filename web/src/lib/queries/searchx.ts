import "server-only";
import { aliasedTable, and, asc, desc, eq, exists, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures, treeEdges } from "@/db/schema";
import { CURRENT_SEASON } from "@/lib/brand";
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

function terms(q: string | undefined): string[] {
  return (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
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
        ilike(people.currentTitle, like),
        ilike(organizations.shortName, like),
        ilike(organizations.name, like),
        ilike(organizations.nickname, like),
        sql`lower(${CONF}) = ${t.toLowerCase()}`,
      )!;
    });
    // "USA South" or "Empire 8" as a whole query matches the conference.
    w.push(or(and(...perTerm), sql`lower(${CONF}) = ${c.q!.trim().toLowerCase()}`)!);
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
      return or(ilike(organizations.name, like), ilike(organizations.shortName, like), ilike(organizations.nickname, like), sql`lower(${CONF}) = ${t.toLowerCase()}`)!;
    });
    w.push(or(and(...perTerm), sql`lower(${CONF}) = ${c.q!.trim().toLowerCase()}`)!);
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
  const q = c.q?.trim() ?? "";
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
  const q = c.q?.trim() ?? "";
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

/** Full conference names for chip titles, keyed by the cleaned abbreviation (the most common name). */
export async function conferenceNames(): Promise<Record<string, string>> {
  const rows = await db
    .select({ abbr: CONF, name: sql<string>`mode() within group (order by ${organizations.conference})` })
    .from(organizations)
    .where(and(eq(organizations.inRegistry, true), sql`${organizations.conferenceAbbr} is not null`))
    .groupBy(CONF);
  return Object.fromEntries(rows.filter((r) => r.abbr).map((r) => [r.abbr, r.name ?? r.abbr]));
}

/* ---------- Worked at / worked under ---------- */

export type OrgRef = { id: string; slug: string; shortName: string; name: string; level: string | null; conference: string | null; inRegistry: boolean };
export type PersonRef = { id: string; slug: string; fullName: string; firstName: string; currentTitle: string | null; orgShortName: string | null };

const orgRefCols = {
  id: organizations.id,
  slug: organizations.slug,
  shortName: organizations.shortName,
  name: organizations.name,
  level: organizations.level,
  conference: CONF,
  inRegistry: organizations.inRegistry,
};

export async function getOrgRef(slug: string): Promise<OrgRef | null> {
  const [row] = await db.select(orgRefCols).from(organizations).where(eq(organizations.slug, slug)).limit(1);
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

const personRefCols = {
  id: people.id,
  slug: people.slug,
  fullName: people.fullName,
  firstName: people.firstName,
  currentTitle: people.currentTitle,
  orgShortName: organizations.shortName,
};

export async function getPersonRef(slug: string): Promise<PersonRef | null> {
  const [row] = await db.select(personRefCols).from(people).leftJoin(organizations, eq(organizations.id, people.currentOrgId)).where(eq(people.slug, slug)).limit(1);
  return row ? { ...row, firstName: firstNameOf(row.firstName, row.fullName) } : null;
}

/** Free text from the no-JS "Worked under" field: exact name, then prefix, then coaches with the biggest trees. */
export async function findPersonByText(text: string): Promise<PersonRef | null> {
  const t = text.trim();
  if (t.length < 2) return null;
  const e = escapeLike(t);
  const mentees = sql`(select count(*) from ${treeEdges} where ${treeEdges.kind} = 'worked_under' and ${treeEdges.mentorId} = ${people.id})`;
  const [row] = await db
    .select(personRefCols)
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(ilike(people.fullName, `%${e}%`))
    .orderBy(sql`case when lower(${people.fullName}) = ${t.toLowerCase()} then 0 when ${people.fullName} ilike ${`${e}%`} then 1 else 2 end`, sql`${mentees} desc`, asc(people.fullName))
    .limit(1);
  return row ? { ...row, firstName: firstNameOf(row.firstName, row.fullName) } : null;
}

/* ---------- Tree context ---------- */

export type Span = { start: number | null; end: number | null; current: boolean; inferred: boolean };

export type TreeContext =
  | ({ kind: "workedUnder"; mentorName: string; mentorFirst: string; mentorSlug: string; org: string } & Span)
  | ({ kind: "workedAt"; org: string; role: string | null } & Span)
  | ({ kind: "viewer"; relation: "mentor" | "mentee" | "peer"; org: string } & Span)
  | { kind: "mentees"; count: number };

const edgeCurrent = (end: number | null) => end == null || end >= CURRENT_SEASON;

/**
 * One line of tree context per person (DESIGN.md §8.7). With a "Worked under" filter: the edge
 * under that coach. With "Worked at": the stint at that program. Otherwise: the viewer's own
 * relationship, then the size of the coach's tree, then the most recent coach they worked under.
 * Edge years are marked inferred when either stint behind them has inferred years.
 */
export async function treeContexts(
  personIds: string[],
  opts: { workedAtOrgId?: string | null; workedUnderId?: string | null; viewerPersonId?: string | null },
): Promise<Map<string, TreeContext>> {
  const out = new Map<string, TreeContext>();
  if (!personIds.length) return out;
  const org = aliasedTable(organizations, "ctx_org");
  const mentor = aliasedTable(people, "ctx_mentor");
  const inferred = sql<boolean>`exists (select 1 from ${tenures} where ${tenures.orgId} = ${treeEdges.orgId} and ${tenures.asPlayer} = false and ${tenures.yearsExplicit} = false and ${tenures.personId} in (${treeEdges.mentorId}, ${treeEdges.menteeId}))`;

  if (opts.workedUnderId) {
    const rows = await db
      .selectDistinctOn([treeEdges.menteeId], {
        personId: treeEdges.menteeId,
        mentorName: mentor.fullName,
        mentorFirstName: mentor.firstName,
        mentorSlug: mentor.slug,
        org: org.shortName,
        start: treeEdges.startYear,
        end: treeEdges.endYear,
        inferred,
      })
      .from(treeEdges)
      .innerJoin(org, eq(org.id, treeEdges.orgId))
      .innerJoin(mentor, eq(mentor.id, treeEdges.mentorId))
      .where(and(eq(treeEdges.kind, "worked_under"), eq(treeEdges.mentorId, opts.workedUnderId), inArray(treeEdges.menteeId, personIds)))
      .orderBy(treeEdges.menteeId, desc(sql`coalesce(${treeEdges.endYear}, 9999)`));
    for (const r of rows) out.set(r.personId, { kind: "workedUnder", mentorName: r.mentorName, mentorFirst: firstNameOf(r.mentorFirstName, r.mentorName), mentorSlug: r.mentorSlug, org: r.org, start: r.start, end: r.end, current: edgeCurrent(r.end), inferred: !!r.inferred });
    return out;
  }

  if (opts.workedAtOrgId) {
    const rows = await db
      .select({
        personId: tenures.personId,
        role: tenures.role,
        start: tenures.startYear,
        end: tenures.endYear,
        current: tenures.isCurrent,
        explicit: tenures.yearsExplicit,
        org: organizations.shortName,
      })
      .from(tenures)
      .innerJoin(organizations, eq(organizations.id, tenures.orgId))
      .where(and(eq(tenures.orgId, opts.workedAtOrgId), eq(tenures.asPlayer, false), inArray(tenures.personId, personIds)))
      .orderBy(desc(tenures.isCurrent), desc(sql`coalesce(${tenures.endYear}, ${tenures.startYear}, 0)`));
    for (const r of rows) {
      const prev = out.get(r.personId);
      if (!prev || prev.kind !== "workedAt") {
        out.set(r.personId, { kind: "workedAt", org: r.org, role: r.role, start: r.start, end: r.current ? null : (r.end ?? r.start), current: r.current, inferred: !r.explicit && r.start != null });
        continue;
      }
      // Several stints at one program: one span from the first season to the last.
      if (r.start != null && (prev.start == null || r.start < prev.start)) prev.start = r.start;
      const end = r.current ? null : (r.end ?? r.start);
      if (!prev.current && end != null && (prev.end == null || end > prev.end)) prev.end = end;
      if (!r.explicit && r.start != null) prev.inferred = true;
    }
    return out;
  }

  const [viewerRows, menteeRows, mentorRows] = await Promise.all([
    opts.viewerPersonId
      ? db
          .select({
            kind: treeEdges.kind,
            mentorId: treeEdges.mentorId,
            menteeId: treeEdges.menteeId,
            org: org.shortName,
            start: treeEdges.startYear,
            end: treeEdges.endYear,
            inferred,
          })
          .from(treeEdges)
          .innerJoin(org, eq(org.id, treeEdges.orgId))
          .where(
            or(
              and(eq(treeEdges.mentorId, opts.viewerPersonId), inArray(treeEdges.menteeId, personIds)),
              and(eq(treeEdges.menteeId, opts.viewerPersonId), inArray(treeEdges.mentorId, personIds)),
            ),
          )
          .orderBy(desc(sql`coalesce(${treeEdges.endYear}, 9999)`), sql`case ${treeEdges.kind} when 'worked_under' then 0 else 1 end`)
      : Promise.resolve([]),
    db
      .select({ personId: treeEdges.mentorId, n: sql<number>`count(distinct ${treeEdges.menteeId})::int` })
      .from(treeEdges)
      .where(and(eq(treeEdges.kind, "worked_under"), inArray(treeEdges.mentorId, personIds)))
      .groupBy(treeEdges.mentorId),
    db
      .selectDistinctOn([treeEdges.menteeId], {
        personId: treeEdges.menteeId,
        mentorName: mentor.fullName,
        mentorFirstName: mentor.firstName,
        mentorSlug: mentor.slug,
        org: org.shortName,
        start: treeEdges.startYear,
        end: treeEdges.endYear,
        inferred,
      })
      .from(treeEdges)
      .innerJoin(org, eq(org.id, treeEdges.orgId))
      .innerJoin(mentor, eq(mentor.id, treeEdges.mentorId))
      .where(and(eq(treeEdges.kind, "worked_under"), inArray(treeEdges.menteeId, personIds)))
      .orderBy(treeEdges.menteeId, desc(sql`coalesce(${treeEdges.endYear}, 9999)`), desc(treeEdges.startYear)),
  ]);

  for (const r of viewerRows) {
    const other = r.mentorId === opts.viewerPersonId ? r.menteeId : r.mentorId;
    if (out.has(other)) continue;
    const relation = r.kind === "worked_alongside" ? "peer" : r.mentorId === opts.viewerPersonId ? "mentee" : "mentor";
    out.set(other, { kind: "viewer", relation, org: r.org, start: r.start, end: r.end, current: edgeCurrent(r.end), inferred: !!r.inferred });
  }
  for (const r of menteeRows) if (!out.has(r.personId) && r.n > 0) out.set(r.personId, { kind: "mentees", count: r.n });
  for (const r of mentorRows) {
    if (out.has(r.personId)) continue;
    out.set(r.personId, { kind: "workedUnder", mentorName: r.mentorName, mentorFirst: firstNameOf(r.mentorFirstName, r.mentorName), mentorSlug: r.mentorSlug, org: r.org, start: r.start, end: r.end, current: edgeCurrent(r.end), inferred: !!r.inferred });
  }
  return out;
}

/* ---------- No-query state ---------- */

export async function searchTotals(): Promise<{ people: number; programs: number }> {
  const [[p], [o]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(people),
    db.select({ n: sql<number>`count(*)::int` }).from(organizations).where(eq(organizations.inRegistry, true)),
  ]);
  return { people: p.n, programs: o.n };
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
