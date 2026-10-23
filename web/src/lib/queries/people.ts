import "server-only";
import { aliasedTable, and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures, treeEdges } from "@/db/schema";
import { seasonCount } from "@/lib/format";

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

/** Consecutive roles at one organization, newest first, like LinkedIn's grouped positions. */
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
    const starts = g.roles.map((r) => r.startYear).filter((y): y is number => !!y);
    const ends = g.roles.map((r) => (r.isCurrent ? null : (r.endYear ?? r.startYear))).filter((y): y is number => !!y);
    g.isCurrent = g.roles.some((r) => r.isCurrent);
    g.startYear = starts.length ? Math.min(...starts) : null;
    g.endYear = g.isCurrent ? null : ends.length ? Math.max(...ends) : null;
    g.seasons = seasonCount(g.startYear, g.endYear, g.isCurrent);
  }
  return groups;
}

export type Profile = {
  person: typeof people.$inferSelect;
  currentOrg: OrgSummary | null;
  experience: ExperienceGroup[];
  playing: TenureRow[];
  stats: { stops: number; seasonsCoached: number | null; treeSize: number };
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
  const firstSeason = Math.min(...rows.filter((r) => !r.asPlayer && r.startYear).map((r) => r.startYear!));
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
      seasonsCoached: Number.isFinite(firstSeason) ? seasonCount(firstSeason, null, true) : null,
      treeSize,
    },
    sources: [...new Set(rows.map((r) => r.sourceUrl).filter((u): u is string => !!u))],
  };
}

export type TreeLink = { person: PersonSummary; org: Pick<OrgSummary, "slug" | "shortName">; startYear: number | null; endYear: number | null };
export type Tree = { mentors: TreeLink[]; mentees: TreeLink[]; peers: TreeLink[] };

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
    .orderBy(desc(treeEdges.endYear));
  const otherIds = edges.map((e) => (e.mentorId === personId ? e.menteeId : e.mentorId));
  const summaries = await getPeopleSummaries([...new Set(otherIds)]);
  const tree: Tree = { mentors: [], mentees: [], peers: [] };
  const seen = new Set<string>();
  for (const e of edges) {
    const otherId = e.mentorId === personId ? e.menteeId : e.mentorId;
    const bucket = e.kind === "worked_alongside" ? "peers" : e.mentorId === personId ? "mentees" : "mentors";
    const key = `${bucket}:${otherId}`;
    const person = summaries.get(otherId);
    if (!person || seen.has(key)) continue;
    seen.add(key);
    tree[bucket].push({ person, org: { slug: e.orgSlug, shortName: e.orgShortName }, startYear: e.startYear, endYear: e.endYear });
  }
  return tree;
}

/** Coaches connected to this person's tree or past programs, for "People you may know" and "Same tree" rails. */
export async function getRelated(personId: string, limit = 5): Promise<PersonSummary[]> {
  const tree = await getTree(personId);
  const ids = [...tree.mentors, ...tree.peers, ...tree.mentees].map((l) => l.person.id).filter((id) => id !== personId);
  const unique = [...new Set(ids)].slice(0, limit);
  const map = await getPeopleSummaries(unique);
  return unique.map((id) => map.get(id)!).filter(Boolean);
}

export async function getDemoPersonId(): Promise<string | null> {
  const [row] = await db.select({ id: people.id }).from(people).where(and(eq(people.isDemo, true))).limit(1);
  return row?.id ?? null;
}
