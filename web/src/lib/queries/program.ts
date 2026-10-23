import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures } from "@/db/schema";
import { CURRENT_SEASON } from "@/lib/brand";
import { conferenceShort, type StintSpan } from "@/lib/format";
import { getOrg, getOrgJobs, getStaff } from "./orgs";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";

/*
 * Queries for the program page (/programs/[slug], DESIGN.md §8.6). Builds on lib/queries/orgs.ts
 * (getOrg, getStaff, getOrgJobs) and adds what that page needs on top: header counts, the current
 * stint of each staff member (for the season ledger), alumni coaches and former players grouped per
 * person with every stint at the program, conference peers and the viewer's followed programs.
 * Wrapped in React cache() so generateMetadata and the page share one round trip per request.
 */

export type ProgramOrg = NonNullable<Awaited<ReturnType<typeof getOrg>>>;

/** The organization behind a program page, any kind (registry program, other college, high school, pro team). */
export const getProgramOrg = cache(async (slug: string): Promise<ProgramOrg | null> => getOrg(slug));

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
      (select count(*)::int from people where current_org_id = ${orgId}) as staff,
      (select count(distinct t.person_id)::int from tenures t join people p on p.id = t.person_id
        where t.org_id = ${orgId} and not t.as_player and p.current_org_id is distinct from ${orgId}) as coached,
      (select count(distinct t.person_id)::int from tenures t where t.org_id = ${orgId} and t.as_player) as played,
      (select count(*)::int from jobs where org_id = ${orgId} and status = 'open') as jobs,
      (select count(*)::int from jobs where org_id = ${orgId} and status = 'open' and (source = 'sample' or is_demo)) as sample_jobs`);
  const r = res.rows[0];
  return { staff: r?.staff ?? 0, coached: r?.coached ?? 0, played: r?.played ?? 0, jobs: r?.jobs ?? 0, sampleJobs: r?.sample_jobs ?? 0 };
});

export type StaffStint = { startYear: number | null; yearsExplicit: boolean; evidence: string | null };

/** For each current staff member: the earliest start of their current stint(s) here, and whether that year is stated or inferred. */
export const getStaffStints = cache(async (orgId: string): Promise<Map<string, StaffStint>> => {
  const rows = await db
    .selectDistinctOn([tenures.personId], {
      personId: tenures.personId,
      startYear: tenures.startYear,
      yearsExplicit: tenures.yearsExplicit,
      evidence: tenures.evidence,
    })
    .from(tenures)
    .innerJoin(people, eq(people.id, tenures.personId))
    .where(and(eq(tenures.orgId, orgId), eq(tenures.isCurrent, true), eq(tenures.asPlayer, false), eq(people.currentOrgId, orgId)))
    .orderBy(tenures.personId, sql`${tenures.startYear} asc nulls last`);
  return new Map(rows.map((r) => [r.personId, { startYear: r.startYear, yearsExplicit: r.yearsExplicit, evidence: r.evidence }]));
});

/** Current staff grouped by unit (Head coach · Offense · Defense · Special teams · Support), from getStaff. */
export const getProgramStaff = cache((orgId: string) => getStaff(orgId));

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
  stints: StintSpan[];
  /** True when a dated stint here has yearsExplicit = false. */
  inferred: boolean;
  /** Evidence quote of the first inferred stint, for the tooltip. */
  inferredEvidence: string | null;
  /** Last season here (current season for an ongoing stint), null when undated. */
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
    const lasts = list.map(lastOf).filter((y): y is number => y != null);
    const firstInferred = list.find((t) => t.startYear && !t.yearsExplicit);
    entries.push({
      person: toSummary(latest),
      currentOrgName: latest.currentOrgName,
      role: latest.role,
      roleCount: new Set(list.map((t) => t.role.trim().toLowerCase())).size,
      stints: list.map((t) => ({ startYear: t.startYear, endYear: t.endYear, isCurrent: t.isCurrent })),
      inferred: !!firstInferred,
      inferredEvidence: firstInferred?.evidence ?? null,
      lastSeason: lasts.length ? Math.max(...lasts) : null,
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

/** Other registry programs in the same conference (footnote markers like "SAA[m]" ignored), with staff counts. */
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
    .leftJoin(people, eq(people.currentOrgId, organizations.id))
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

/** Demo follows live in a cookie (no follows table yet): a JSON array of organization ids. */
export const FOLLOW_COOKIE = "cn_follows";
export const FOLLOW_LIMIT = 200;

export function parseFollowCookie(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, FOLLOW_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Organization ids the current browser follows. */
export async function getFollowedOrgIds(): Promise<string[]> {
  return parseFollowCookie((await cookies()).get(FOLLOW_COOKIE)?.value);
}
