import "server-only";
import { aliasedTable, and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures, treeEdges, users } from "@/db/schema";
import { seasonSpans, seasonsCovered } from "@/lib/format";

export type OrgSummary = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  nickname: string | null;
  level: string | null;
  conference: string | null;
  conferenceAbbr: string | null;
  state: string | null;
  inRegistry: boolean;
  kind: "college" | "high_school" | "pro" | "other";
};

export type PersonSummary = {
  id: string;
  slug: string;
  fullName: string;
  currentTitle: string | null;
  roleGroup: string | null;
  claimed: boolean;
  isDemo: boolean;
  org: Pick<OrgSummary, "slug" | "shortName" | "nickname" | "conferenceAbbr" | "level"> | null;
};

export type TenureRow = {
  id: number;
  role: string;
  roleGroup: string;
  unit: string | null;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  asPlayer: boolean;
  yearsExplicit: boolean;
  evidence: string | null;
  sourceUrl: string | null;
  verified: boolean;
  org: OrgSummary;
};

/**
 * Consecutive roles at one organization, newest first, like LinkedIn's grouped positions.
 *
 * Render the group's range with seasonRangeMulti(g.roles) (or <SeasonRange stints={g.roles}>): it shows
 * gaps ("1995–1996, 2014–Present") and never stretches an old start year to Present.
 * - startYear/endYear: the most recent continuous run of seasons only (seasonSpans), so even a plain
 *   seasonRange(startYear, endYear, isCurrent) never implies unbroken tenure across a gap. startYear is
 *   null when that run is an undated current role.
 * - isCurrent: any role here is current.
 * - seasons: distinct seasons covered by all the roles here (seasonsCovered), null when none is dated.
 */
export type ExperienceGroup = {
  org: OrgSummary;
  roles: TenureRow[];
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  seasons: number | null;
};

const orgCols = {
  id: organizations.id,
  slug: organizations.slug,
  name: organizations.name,
  shortName: organizations.shortName,
  nickname: organizations.nickname,
  level: organizations.level,
  conference: organizations.conference,
  conferenceAbbr: organizations.conferenceAbbr,
  state: organizations.state,
  inRegistry: organizations.inRegistry,
  kind: organizations.kind,
};

export const personSummaryCols = {
  id: people.id,
  slug: people.slug,
  fullName: people.fullName,
  currentTitle: people.currentTitle,
  roleGroup: people.roleGroup,
  claimed: people.claimed,
  isDemo: people.isDemo,
  orgSlug: organizations.slug,
  orgShortName: organizations.shortName,
  orgNickname: organizations.nickname,
  orgConferenceAbbr: organizations.conferenceAbbr,
  orgLevel: organizations.level,
};

type SummaryRow = {
  id: string;
  slug: string;
  fullName: string;
  currentTitle: string | null;
  roleGroup: string | null;
  claimed: boolean;
  isDemo: boolean;
  orgSlug: string | null;
  orgShortName: string | null;
  orgNickname: string | null;
  orgConferenceAbbr: string | null;
  orgLevel: string | null;
};

export function toSummary(r: SummaryRow): PersonSummary {
  return {
    id: r.id,
    slug: r.slug,
    fullName: r.fullName,
    currentTitle: r.currentTitle,
    roleGroup: r.roleGroup,
    claimed: r.claimed,
    isDemo: r.isDemo,
    org: r.orgSlug
      ? { slug: r.orgSlug, shortName: r.orgShortName!, nickname: r.orgNickname, conferenceAbbr: r.orgConferenceAbbr, level: r.orgLevel }
      : null,
  };
}

export async function getPeopleSummaries(ids: string[]): Promise<Map<string, PersonSummary>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select(personSummaryCols)
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(inArray(people.id, ids));
  return new Map(rows.map((r) => [r.id, toSummary(r)]));
}

export function groupExperience(rows: TenureRow[]): ExperienceGroup[] {
  const coaching = rows.filter((r) => !r.asPlayer);
  const groups: ExperienceGroup[] = [];
  for (const r of coaching) {
    const last = groups[groups.length - 1];
    if (last && last.org.id === r.org.id) last.roles.push(r);
    else groups.push({ org: r.org, roles: [r], startYear: null, endYear: null, isCurrent: false, seasons: null });
  }
  for (const g of groups) {
    g.isCurrent = g.roles.some((r) => r.isCurrent);
    g.seasons = seasonsCovered(g.roles);
    if (g.seasons === null) {
      // No start year anywhere: keep only a known last season, never invent a start.
      const ends = g.roles.map((r) => (r.isCurrent ? null : r.endYear)).filter((y): y is number => !!y);
      g.startYear = null;
      g.endYear = g.isCurrent || !ends.length ? null : Math.max(...ends);
      continue;
    }
    const spans = seasonSpans(g.roles);
    const latest = spans[spans.length - 1];
    g.startYear = latest.undatedCurrent ? null : latest.start;
    g.endYear = latest.isCurrent ? null : latest.end;
  }
  return groups;
}

export type Profile = {
  person: typeof people.$inferSelect;
  currentOrg: OrgSummary | null;
  experience: ExperienceGroup[];
  playing: TenureRow[];
  /**
   * seasonsCoached: distinct seasons the coaching stints cover (seasonsCovered): gaps aren't counted and an
   * undated current role adds one season, so it never claims more than the source; null when nothing is dated.
   * firstSeason: earliest coaching start year in the source.
   */
  stats: { stops: number; seasonsCoached: number | null; treeSize: number; firstSeason: number | null };
  sources: string[];
};

export async function getProfile(slug: string): Promise<Profile | null> {
  const [person] = await db.select().from(people).where(eq(people.slug, slug)).limit(1);
  if (!person) return null;
  const rows = await db
    .select({
      id: tenures.id,
      role: tenures.role,
      roleGroup: tenures.roleGroup,
      unit: tenures.unit,
      startYear: tenures.startYear,
      endYear: tenures.endYear,
      isCurrent: tenures.isCurrent,
      asPlayer: tenures.asPlayer,
      yearsExplicit: tenures.yearsExplicit,
      evidence: tenures.evidence,
      sourceUrl: tenures.sourceUrl,
      verified: tenures.verified,
      org: orgCols,
    })
    .from(tenures)
    .innerJoin(organizations, eq(organizations.id, tenures.orgId))
    .where(eq(tenures.personId, person.id))
    .orderBy(asc(tenures.sortOrder));
  const currentOrg = person.currentOrgId
    ? ((await db.select(orgCols).from(organizations).where(eq(organizations.id, person.currentOrgId)).limit(1))[0] ?? null)
    : null;
  const experience = groupExperience(rows as TenureRow[]);
  const playing = (rows as TenureRow[]).filter((r) => r.asPlayer);
  const coaching = (rows as TenureRow[]).filter((r) => !r.asPlayer);
  const firstSeason = Math.min(...coaching.filter((r) => r.startYear).map((r) => r.startYear!));
  const [{ n: treeSize }] = await db
    .select({ n: sql<number>`count(distinct case when ${treeEdges.mentorId} = ${person.id} then ${treeEdges.menteeId} else ${treeEdges.mentorId} end)::int` })
    .from(treeEdges)
    .where(or(eq(treeEdges.mentorId, person.id), eq(treeEdges.menteeId, person.id)));
  return {
    person,
    currentOrg,
    experience,
    playing,
    stats: {
      stops: new Set(experience.map((g) => g.org.id)).size,
      seasonsCoached: seasonsCovered(coaching),
      treeSize,
      firstSeason: Number.isFinite(firstSeason) ? firstSeason : null,
    },
    sources: [...new Set(rows.map((r) => r.sourceUrl).filter((u): u is string => !!u))],
  };
}

/** One contiguous run of seasons two coaches shared on a staff (one tree_edges row). */
export type TreePeriod = { startYear: number | null; endYear: number | null; orgShortName: string };

/**
 * One person in a coaching-tree bucket.
 * - periods: every overlap period with this person in this bucket (tree_edges stores one row per
 *   contiguous run of seasons, so a pair can have several, possibly at different programs), most recent first.
 * - org, startYear, endYear: the most recent period, for callers that show a single range.
 */
export type TreeLink = {
  person: PersonSummary;
  org: Pick<OrgSummary, "slug" | "shortName">;
  startYear: number | null;
  endYear: number | null;
  periods: TreePeriod[];
};
export type Tree = { mentors: TreeLink[]; mentees: TreeLink[]; peers: TreeLink[] };

/** A tree_edges row joined to its organization, as getTree reads it. */
export type TreeEdgeRow = {
  kind: "worked_under" | "worked_alongside";
  mentorId: string;
  menteeId: string;
  startYear: number | null;
  endYear: number | null;
  orgSlug: string;
  orgShortName: string;
};

/** Most recent first: by end year, then start year; undated last. */
const byRecency = (a: { startYear: number | null; endYear: number | null }, b: { startYear: number | null; endYear: number | null }) =>
  (b.endYear ?? b.startYear ?? -Infinity) - (a.endYear ?? a.startYear ?? -Infinity) || (b.startYear ?? -Infinity) - (a.startYear ?? -Infinity);

/**
 * Group a coach's edge rows into the three tree buckets, one link per (bucket, person) with all of
 * that pair's periods. Pure, so it can be tested without a database. People missing from
 * `summaries` are left out. Within a bucket, people are ordered by their most recent period.
 */
export function aggregateTree(personId: string, edges: TreeEdgeRow[], summaries: Map<string, PersonSummary>): Tree {
  const tree: Tree = { mentors: [], mentees: [], peers: [] };
  const links = new Map<string, TreeLink>();
  for (const e of [...edges].sort(byRecency)) {
    const otherId = e.mentorId === personId ? e.menteeId : e.mentorId;
    const bucket = e.kind === "worked_alongside" ? "peers" : e.mentorId === personId ? "mentees" : "mentors";
    const person = summaries.get(otherId);
    if (!person) continue;
    const period: TreePeriod = { startYear: e.startYear, endYear: e.endYear, orgShortName: e.orgShortName };
    const key = `${bucket}:${otherId}`;
    const link = links.get(key);
    if (link) {
      link.periods.push(period);
      continue;
    }
    const created: TreeLink = { person, org: { slug: e.orgSlug, shortName: e.orgShortName }, startYear: e.startYear, endYear: e.endYear, periods: [period] };
    links.set(key, created);
    tree[bucket].push(created);
  }
  return tree;
}

/** The coach's coaching tree: who they worked under, who worked under them, and who they worked alongside. */
export async function getTree(personId: string): Promise<Tree> {
  const org = aliasedTable(organizations, "edge_org");
  const edges = await db
    .select({
      kind: treeEdges.kind,
      mentorId: treeEdges.mentorId,
      menteeId: treeEdges.menteeId,
      startYear: treeEdges.startYear,
      endYear: treeEdges.endYear,
      orgSlug: org.slug,
      orgShortName: org.shortName,
    })
    .from(treeEdges)
    .innerJoin(org, eq(org.id, treeEdges.orgId))
    .where(or(eq(treeEdges.mentorId, personId), eq(treeEdges.menteeId, personId)))
    .orderBy(desc(treeEdges.endYear), desc(treeEdges.startYear));
  const otherIds = edges.map((e) => (e.mentorId === personId ? e.menteeId : e.mentorId));
  const summaries = await getPeopleSummaries([...new Set(otherIds)]);
  return aggregateTree(personId, edges, summaries);
}

/** Coaches connected to this person's tree or past programs, for "People you may know" and "Same tree" rails. */
export async function getRelated(personId: string, limit = 5): Promise<PersonSummary[]> {
  const tree = await getTree(personId);
  const ids = [...tree.mentors, ...tree.peers, ...tree.mentees].map((l) => l.person.id).filter((id) => id !== personId);
  const unique = [...new Set(ids)].slice(0, limit);
  const map = await getPeopleSummaries(unique);
  return unique.map((id) => map.get(id)!).filter(Boolean);
}

/**
 * The person the coach demo account views the product as (a real, unclaimed record; see scripts/seed.ts).
 * Not "the first isDemo person": the isDemo people are the fictional pipeline candidates.
 */
export async function getDemoPersonId(): Promise<string | null> {
  const [row] = await db
    .select({ id: users.personId })
    .from(users)
    .where(and(eq(users.isDemo, true), eq(users.kind, "coach"), isNotNull(users.personId)))
    .orderBy(asc(users.id))
    .limit(1);
  return row?.id ?? null;
}
