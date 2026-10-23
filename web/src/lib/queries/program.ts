import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures } from "@/db/schema";
import { CURRENT_SEASON } from "@/lib/brand";
import { conferenceShort, seasonSpans, type StintSpan } from "@/lib/format";
import { getOrg, getOrgJobs } from "./orgs";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";

/*
 * Queries for the program page (/programs/[slug], DESIGN.md §8.6). Builds on lib/queries/orgs.ts
 * (getOrg, getOrgJobs) and adds what that page needs on top: header counts, current staff grouped by
 * unit with their seasons at the program (for the ledger), alumni coaches and former players grouped
 * per person with every stint at the program, conference peers and the viewer's followed programs.
 * Wrapped in React cache() so generateMetadata and the page share one round trip per request.
 *
 * One policy for every list and count here, so a number always equals the rows it counts:
 * - fictional demo people (people.is_demo) are never listed or counted on a program (as orgs.ts getStaff);
 * - only football stints (tenures.sport = 'football') place a person at a football program.
 */

export type ProgramOrg = NonNullable<Awaited<ReturnType<typeof getOrg>>>;

/**
 * The pipeline's catch-all buckets ("Unnamed high school", slug unknown-high-school) hold stints whose
 * bio named an organization we couldn't identify. They are not one organization, so they get no page.
 */
export function isPlaceholderOrg(org: { id: string; slug: string; name: string }): boolean {
  return org.id.startsWith("org-unknown-") || org.slug.startsWith("unknown-") || /^unnamed\b/i.test(org.name);
}

/** The organization behind a program page, any kind (registry program, other college, high school, pro team); null for placeholders. */
export const getProgramOrg = cache(async (slug: string): Promise<ProgramOrg | null> => {
  const org = await getOrg(slug);
  return org && !isPlaceholderOrg(org) ? org : null;
});

export type ProgramCounts = {
  /** People whose current job is at this organization (the Staff tab). */
  staff: number;
  /** People who coached here before their current job (the Alumni coaches tab). */
  coached: number;
  /** People who played here (any current job, including this staff). */
  played: number;
  /** Open jobs (the Jobs tab) and how many of them are sample listings. */
  jobs: number;
  sampleJobs: number;
};

/** Header and tab counts. Each uses the same filters as the list it counts, so the numbers always match. */
export const getProgramCounts = cache(async (orgId: string): Promise<ProgramCounts> => {
  const res = await db.execute<{ staff: number; coached: number; played: number; jobs: number; sample_jobs: number }>(sql`
    select
      (select count(*)::int from people where current_org_id = ${orgId} and not is_demo) as staff,
      (select count(distinct t.person_id)::int from tenures t join people p on p.id = t.person_id
        where t.org_id = ${orgId} and not t.as_player and t.sport = 'football' and not p.is_demo
          and p.current_org_id is distinct from ${orgId}) as coached,
      (select count(distinct t.person_id)::int from tenures t join people p on p.id = t.person_id
        where t.org_id = ${orgId} and t.as_player and t.sport = 'football' and not p.is_demo) as played,
      (select count(*)::int from jobs where org_id = ${orgId} and status = 'open') as jobs,
      (select count(*)::int from jobs where org_id = ${orgId} and status = 'open' and (source = 'sample' or is_demo)) as sample_jobs`);
  const r = res.rows[0];
  return { staff: r?.staff ?? 0, coached: r?.coached ?? 0, played: r?.played ?? 0, jobs: r?.jobs ?? 0, sampleJobs: r?.sample_jobs ?? 0 };
});

/**
 * A stint at the program with its year provenance (tenures.years_explicit and the evidence quote), so
 * the ledger can dot exactly the years that are inferred (§6.2; components/program/LedgerRange).
 */
export type LedgerStint = StintSpan & { yearsExplicit: boolean; evidence: string | null };

/*
 * Which printed years are inferred (§6.2). The ledger prints the start and end of each merged run of
 * seasons (seasonSpans, the same runs seasonRangeMulti prints), and a rail prints first–last season
 * (seasonRangeCompact). A printed year is inferred when every stint that starts (or ends) the run on
 * that year has yearsExplicit = false; a year one stint states and another infers counts as stated.
 * components/program/LedgerRange renders these pieces, dotting only the inferred years.
 */
export type RangeYear = { year: number; text: string; inferred: boolean; evidence: string | null };
export type RangePiece = string | RangeYear;

function markYear(stints: LedgerStint[], year: number, edge: "start" | "end", text = String(year)): RangeYear {
  const hits = stints.filter((s) => {
    if (edge === "start") return s.startYear ? s.startYear === year : !s.isCurrent && s.endYear === year;
    const end = s.startYear ? Math.max(s.startYear, s.endYear ?? s.startYear) : s.endYear;
    return !s.isCurrent && end === year;
  });
  const inferred = hits.length > 0 && hits.every((s) => !s.yearsExplicit);
  return { year, text, inferred, evidence: inferred ? (hits.find((s) => s.evidence)?.evidence ?? null) : null };
}

/** The ledger range as pieces, spelling exactly what seasonRangeMulti() prints; null when no stint has a start year. */
export function ledgerRangePieces(stints: LedgerStint[]): RangePiece[] | null {
  if (!stints.some((s) => s.startYear)) return null;
  const out: RangePiece[] = [];
  seasonSpans(stints).forEach((m, i) => {
    if (i > 0) out.push(", ");
    if (m.undatedCurrent) out.push("Present");
    else if (m.isCurrent) out.push(markYear(stints, m.start, "start"), "–Present");
    else if (m.start === m.end) {
      const a = markYear(stints, m.start, "start");
      const b = markYear(stints, m.end, "end");
      out.push({ ...a, inferred: a.inferred || b.inferred, evidence: a.evidence ?? b.evidence });
    } else out.push(markYear(stints, m.start, "start"), "–", markYear(stints, m.end, "end"));
  });
  return out;
}

/** First to last dated season, as a rail prints it with seasonRangeCompact() ("2008–11", "2020–"). */
export function compactSpan(stints: StintSpan[]): { start: number; end: number | null; current: boolean } | null {
  const dated = stints.filter((s) => s.startYear);
  if (!dated.length) return null;
  const current = dated.some((s) => s.isCurrent);
  const start = Math.min(...dated.map((s) => s.startYear!));
  const end = current ? null : Math.max(...dated.map((s) => s.endYear ?? s.startYear!));
  return { start, end, current };
}

/** The compact (rail) range as pieces, spelling exactly what seasonRangeCompact() prints. */
export function compactRangePieces(stints: LedgerStint[]): RangePiece[] | null {
  const span = compactSpan(stints);
  if (!span) return null;
  const { start, end, current } = span;
  if (current) return [markYear(stints, start, "start"), "–"];
  const last = end ?? start;
  if (last === start) return [markYear(stints, start, "start")];
  const short = Math.floor(last / 100) === Math.floor(start / 100) ? String(last).slice(2) : String(last);
  return [markYear(stints, start, "start"), "–", markYear(stints, last, "end", short)];
}

/** The first inferred year a range prints, or null (decides whether a page must explain the dotted mark). */
export function firstInferredYear(stints: LedgerStint[], variant: "ledger" | "compact" = "ledger"): RangeYear | null {
  const pieces = variant === "compact" ? compactRangePieces(stints) : ledgerRangePieces(stints);
  return (pieces?.find((p) => typeof p !== "string" && p.inferred) as RangeYear | undefined) ?? null;
}

/** The last season a set of stints prints in the ledger; null when none has a start year ("Years not in source"). */
function lastDatedSeason(stints: StintSpan[]): number | null {
  const lasts = stints.filter((s) => s.startYear).map((s) => (s.isCurrent ? CURRENT_SEASON : Math.max(s.startYear!, s.endYear ?? s.startYear!)));
  return lasts.length ? Math.max(...lasts) : null;
}

/**
 * For each current staff member: all their coaching stints here (not just the current role), so the
 * ledger reads time on staff ("2018–Present · 9 seasons") the way the profile's program group does.
 */
export const getStaffStints = cache(async (orgId: string): Promise<Map<string, LedgerStint[]>> => {
  const rows = await db
    .select({
      personId: tenures.personId,
      startYear: tenures.startYear,
      endYear: tenures.endYear,
      isCurrent: tenures.isCurrent,
      yearsExplicit: tenures.yearsExplicit,
      evidence: tenures.evidence,
    })
    .from(tenures)
    .innerJoin(people, eq(people.id, tenures.personId))
    .where(
      and(
        eq(tenures.orgId, orgId),
        eq(tenures.asPlayer, false),
        eq(tenures.sport, "football"),
        eq(people.currentOrgId, orgId),
        eq(people.isDemo, false),
      ),
    )
    .orderBy(asc(tenures.personId), asc(tenures.sortOrder));
  const byPerson = new Map<string, LedgerStint[]>();
  for (const { personId, ...stint } of rows) {
    const list = byPerson.get(personId) ?? [];
    list.push(stint);
    byPerson.set(personId, list);
  }
  return byPerson;
});

/**
 * Program staff units (§8.6) in page order. "Assistant coaches" holds coaches whose record has no unit
 * and whose title doesn't name a side of the ball ("Assistant Coach"); "Support staff" is kept for
 * operations, video, equipment and other non-coaching roles.
 */
export type ProgramStaffUnit = "head" | "offense" | "defense" | "special_teams" | "assistant" | "support";

export const PROGRAM_STAFF_UNITS: ProgramStaffUnit[] = ["head", "offense", "defense", "special_teams", "assistant", "support"];

export const PROGRAM_STAFF_UNIT_LABEL: Record<ProgramStaffUnit, string> = {
  head: "Head coach",
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special teams",
  assistant: "Assistant coaches",
  support: "Support staff",
};

const UNIT_PATTERNS: [Extract<ProgramStaffUnit, "offense" | "defense" | "special_teams">, RegExp][] = [
  ["special_teams", /\bspecial teams\b|\bspecialists?\b|\bkick(?:ers?|ing)\b|\bpunt(?:ers?|ing)\b|\blong snap/i],
  [
    "offense",
    /\boffens|\bquarterbacks?\b|\bqbs?\b|\breceivers?\b|\bwrs?\b|\brunnings? ?backs?\b|\brbs?\b|\btight ends?\b|\btes\b|\bfullbacks?\b|\bfbs\b|\bslots?\b|\bo-?line\b|\bol\b/i,
  ],
  [
    "defense",
    /\bdefens|\blinebackers?\b|\b[io]?lbs?\b|\bcorner(?:back)?s?\b|\bsafet(?:y|ies)\b|\brovers?\b|\bsecondary\b|\bdbs?\b|\bd-?line\b|\bdl\b|\bnickels?\b|\bedge\b/i,
  ],
];

/** The side of the ball a title names: the earliest match in its first "/" segment, else in the whole title. */
function unitFromTitle(title: string): Extract<ProgramStaffUnit, "offense" | "defense" | "special_teams"> | null {
  for (const text of [title.split("/")[0], title]) {
    let best: { unit: Extract<ProgramStaffUnit, "offense" | "defense" | "special_teams">; at: number } | null = null;
    for (const [unit, re] of UNIT_PATTERNS) {
      const m = re.exec(text);
      if (m && (!best || m.index < best.at)) best = { unit, at: m.index };
    }
    if (best) return best.unit;
  }
  return null;
}

const COACH_TITLE = /\bcoach|\bassistant\b|\bgraduate\b|\bga\b|\bfellow\b|\bquality control\b|\banalyst\b/i;

/**
 * Staff unit for one person. Head coaches first; a title that leads with special teams ("Special Teams
 * Coordinator / Defensive Backs Coach") files under Special teams whatever the stored unit; then the
 * stored unit; coaches without one are placed by their title, and the rest go to Assistant coaches.
 */
function programStaffUnit(roleGroup: string | null, unit: string | null, title: string | null): ProgramStaffUnit {
  if (roleGroup === "head_coach") return "head";
  const t = title?.trim() ?? "";
  if (/^special teams\b/i.test(t.split("/")[0].trim())) return "special_teams";
  if (unit === "offense" || unit === "defense" || unit === "special_teams") return unit;
  if (unit === "staff" || roleGroup === "support" || roleGroup === "other" || roleGroup === "player" || !roleGroup) return "support";
  return unitFromTitle(t) ?? (COACH_TITLE.test(t) || !t ? "assistant" : "support");
}

const ROLE_RANK: Record<string, number> = { head_coach: 0, coordinator: 1, position_coach: 2, ga_analyst: 3, support: 4, other: 5 };

/**
 * Current staff grouped by unit (Head coach · Offense · Defense · Special teams · Assistant coaches ·
 * Support staff), coordinators before position coaches, then by name. Same people as orgs.ts getStaff
 * (demo people excluded); only the grouping differs, so the header count equals the rows.
 */
export const getProgramStaff = cache(async (orgId: string): Promise<{ unit: ProgramStaffUnit; people: PersonSummary[] }[]> => {
  const rows = await db
    .select({ ...personSummaryCols, unit: people.unit })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(people.currentOrgId, orgId), eq(people.isDemo, false)))
    .orderBy(asc(people.fullName));
  rows.sort((a, b) => (ROLE_RANK[a.roleGroup ?? "other"] ?? 9) - (ROLE_RANK[b.roleGroup ?? "other"] ?? 9));
  const buckets = new Map<ProgramStaffUnit, PersonSummary[]>(PROGRAM_STAFF_UNITS.map((u) => [u, []]));
  for (const r of rows) buckets.get(programStaffUnit(r.roleGroup, r.unit, r.currentTitle))!.push(toSummary(r));
  return PROGRAM_STAFF_UNITS.filter((u) => buckets.get(u)!.length).map((u) => ({ unit: u, people: buckets.get(u)! }));
});

/** Open jobs at the organization, newest first, from getOrgJobs. */
export const getProgramJobs = cache((orgId: string) => getOrgJobs(orgId));

/**
 * The shared getAlumni() keeps one stint per person and no year provenance. The program page needs
 * every stint (for "2003, 2006–2009" ranges) and yearsExplicit (inferred years are marked, §6.2), so
 * it groups the stints itself. getAlumni stays the quick list for other callers.
 */
export type AlumniEntry = {
  person: PersonSummary;
  /** Current organization's full name (for OrgMark initials that match the program's own tile). */
  currentOrgName: string | null;
  /** Most recent role at this organization. */
  role: string;
  /** Distinct roles held here. */
  roleCount: number;
  /** Every stint here, with year provenance (inferred years are dotted, §6.2). */
  stints: LedgerStint[];
  /** True when a year the ledger prints for these stints is inferred (firstInferredYear). */
  inferred: boolean;
  /** Evidence quote behind that year, for the tooltip. */
  inferredEvidence: string | null;
  /**
   * Last season the ledger prints (current season for an ongoing stint); null when no stint here has a
   * start year, so a row that reads "Years not in source" never sorts by a year it doesn't show.
   */
  lastSeason: number | null;
};

async function groupedStints(orgId: string, asPlayer: boolean): Promise<AlumniEntry[]> {
  const rows = await db
    .select({
      ...personSummaryCols,
      currentOrgName: organizations.name,
      role: tenures.role,
      startYear: tenures.startYear,
      endYear: tenures.endYear,
      isCurrent: tenures.isCurrent,
      yearsExplicit: tenures.yearsExplicit,
      evidence: tenures.evidence,
      sortOrder: tenures.sortOrder,
    })
    .from(tenures)
    .innerJoin(people, eq(people.id, tenures.personId))
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(
      and(
        eq(tenures.orgId, orgId),
        eq(tenures.asPlayer, asPlayer),
        eq(tenures.sport, "football"),
        eq(people.isDemo, false),
        // Coaches still on staff belong to the Staff tab; former players are listed wherever they coach now.
        asPlayer ? undefined : sql`${people.currentOrgId} is distinct from ${orgId}`,
      ),
    )
    .orderBy(asc(people.id), asc(tenures.sortOrder));

  const byPerson = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byPerson.get(r.id);
    if (list) list.push(r);
    else byPerson.set(r.id, [r]);
  }

  const lastOf = (t: (typeof rows)[number]) => (t.isCurrent ? CURRENT_SEASON : (t.endYear ?? t.startYear));
  const entries: AlumniEntry[] = [];
  for (const list of byPerson.values()) {
    // Most recent stint: latest last season; undated stints fall back to the profile order (lower sortOrder = newer).
    const latest = [...list].sort((a, b) => (lastOf(b) ?? -1) - (lastOf(a) ?? -1) || a.sortOrder - b.sortOrder)[0];
    const stints = list.map((t) => ({ startYear: t.startYear, endYear: t.endYear, isCurrent: t.isCurrent, yearsExplicit: t.yearsExplicit, evidence: t.evidence }));
    const inferredYear = firstInferredYear(stints);
    entries.push({
      person: toSummary(latest),
      currentOrgName: latest.currentOrgName,
      role: latest.role,
      roleCount: new Set(list.map((t) => t.role.trim().toLowerCase())).size,
      stints,
      inferred: !!inferredYear,
      inferredEvidence: inferredYear?.evidence ?? null,
      lastSeason: lastDatedSeason(stints),
    });
  }
  // Most recent first; undated last, then by name.
  return entries.sort((a, b) => (b.lastSeason ?? -1) - (a.lastSeason ?? -1) || a.person.fullName.localeCompare(b.person.fullName));
}

/** People who coached here before their current job, most recent first, with every stint here. */
export const getProgramAlumni = cache((orgId: string) => groupedStints(orgId, false));

/** People who played here and now coach (anywhere, including this staff), most recent first. */
export const getProgramPlayers = cache((orgId: string) => groupedStints(orgId, true));

export type PeerProgram = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  nickname: string | null;
  state: string | null;
  staff: number;
};

/** Other registry programs in the same conference (footnote markers like "SAA[m]" ignored), with staff counts (demo people excluded, as on their pages). */
export const getConferencePeers = cache(async (orgId: string, conferenceAbbr: string | null): Promise<PeerProgram[]> => {
  const abbr = conferenceShort(conferenceAbbr);
  if (!abbr || abbr.toLowerCase() === "independent") return [];
  return db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      shortName: organizations.shortName,
      nickname: organizations.nickname,
      state: organizations.state,
      staff: count(people.id),
    })
    .from(organizations)
    .leftJoin(people, and(eq(people.currentOrgId, organizations.id), eq(people.isDemo, false)))
    .where(
      and(
        eq(organizations.inRegistry, true),
        ne(organizations.id, orgId),
        sql`regexp_replace(${organizations.conferenceAbbr}, '\\[[^]]*\\]', '', 'g') = ${abbr}`,
      ),
    )
    .groupBy(organizations.id)
    .orderBy(asc(organizations.shortName));
});

/** Registry program by id (server actions validate a follow target with it). */
export async function getRegistryProgramById(orgId: string) {
  const [row] = await db
    .select({ id: organizations.id, slug: organizations.slug, shortName: organizations.shortName })
    .from(organizations)
    .where(and(eq(organizations.id, orgId), eq(organizations.inRegistry, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Demo follows live in a cookie until a follows table exists: a JSON object of organization ids per
 * demo user ({"u-demo-coach": ["ncaa-2751"]}), so switching accounts in the Me menu switches follows.
 */
export const FOLLOW_COOKIE = "cn_follows";
/** Per demo user, and demo users kept, so the cookie stays well under the 4 KB browser limit. */
export const FOLLOW_LIMIT = 50;
export const FOLLOW_USERS_LIMIT = 5;

export type FollowMap = Record<string, string[]>;

/** The whole cookie; anything malformed (including the old shared array) reads as no follows. */
export function parseFollowCookie(value: string | undefined): FollowMap {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: FollowMap = {};
    for (const [user, ids] of Object.entries(parsed).slice(0, FOLLOW_USERS_LIMIT)) {
      if (Array.isArray(ids)) out[user] = ids.filter((x): x is string => typeof x === "string").slice(0, FOLLOW_LIMIT);
    }
    return out;
  } catch {
    return {};
  }
}

/** Organization ids a demo user follows (none when signed out). */
export async function getFollowedOrgIds(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return [];
  return parseFollowCookie((await cookies()).get(FOLLOW_COOKIE)?.value)[userId] ?? [];
}
