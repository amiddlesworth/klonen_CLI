import "server-only";
import { cache } from "react";
import { aliasedTable, and, asc, desc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { connections, jobs, organizations, people, tenures, treeEdges } from "@/db/schema";
import { edgeYears, playedUnder, type EdgeRef, type LinkYears, type YearStint } from "@/components/profile/linkYears";
import { byTenure } from "@/components/profile/model";
import {
  aggregateTree,
  getPeopleSummaries,
  getProfile,
  getTree,
  personSummaryCols,
  toSummary,
  type ExperienceGroup,
  type PersonSummary,
  type Profile,
  type TenureRow,
  type TreeLink,
} from "./people";
import { visibleJobs } from "@/lib/demo-scope";

export type { ExperienceGroup, PersonSummary, Profile, TenureRow, Tree, TreeLink } from "./people";
export type { LinkYears } from "@/components/profile/linkYears";

/*
 * Extra queries for the coach profile /in/[slug] (DESIGN.md §8.4). The core record comes from
 * getProfile / getTree in people.ts; this file adds the rail cards and viewer-specific state.
 */

/** A stint with its sport ("football", "women's basketball"), so the profile counts football coaching only. */
export type SportTenureRow = TenureRow & { sport: string };

/** getProfile with every stint's sport attached (the profile's coaching numbers use it). */
export type ProfileWithSports = Omit<Profile, "experience" | "playing"> & {
  experience: (Omit<ExperienceGroup, "roles"> & { roles: SportTenureRow[] })[];
  playing: SportTenureRow[];
};

/**
 * getProfile plus each stint's sport. A role in another sport (a women's basketball head coach) is listed
 * on the profile under its sport and kept out of seasons coached, first season, coaching stops and the
 * season strip (model.ts isFootballCoaching).
 */
async function getProfileWithSports(slug: string): Promise<ProfileWithSports | null> {
  const profile = await getProfile(slug);
  if (!profile) return null;
  const rows = await db.select({ id: tenures.id, sport: tenures.sport }).from(tenures).where(eq(tenures.personId, profile.person.id));
  const sportOf = new Map(rows.map((r) => [r.id, r.sport]));
  const withSport = (r: TenureRow): SportTenureRow => ({ ...r, sport: sportOf.get(r.id) ?? "football" });
  return {
    ...profile,
    experience: profile.experience.map((g) => ({ ...g, roles: g.roles.map(withSport) })),
    playing: profile.playing.map(withSport),
  };
}

/** getProfile (with each stint's sport), deduplicated per request (generateMetadata and the page both need it). */
export const getProfileCached = cache(getProfileWithSports);

/** getTree, deduplicated per request. */
export const getTreeCached = cache(getTree);

/** Every stint (coaching and playing) of these people at these organizations, as linkYears reads them. */
async function getYearStints(personIds: string[], orgIds?: string[]): Promise<YearStint[]> {
  if (!personIds.length || (orgIds && !orgIds.length)) return [];
  return db
    .select({
      personId: tenures.personId,
      orgId: tenures.orgId,
      roleGroup: tenures.roleGroup,
      sport: tenures.sport,
      startYear: tenures.startYear,
      endYear: tenures.endYear,
      isCurrent: tenures.isCurrent,
      asPlayer: tenures.asPlayer,
      yearsExplicit: tenures.yearsExplicit,
      evidence: tenures.evidence,
    })
    .from(tenures)
    .where(orgIds ? and(inArray(tenures.personId, personIds), inArray(tenures.orgId, orgIds)) : inArray(tenures.personId, personIds));
}

/** A player relationship between the coach and a tree person ("Played for Ian 2024–25"). */
export type PlayerLink = {
  /** "played_for": the tree person played for the coach. "coached": the tree person coached the coach as a player. */
  kind: "played_for" | "coached";
  years: LinkYears;
};

/**
 * A tree link with what its years can honestly show (linkYears): no start year the source never gave
 * (an undated current stint is not a 2026 hire), inferred years flagged with their evidence.
 */
export type ProfileTreeLink = TreeLink & { years: LinkYears; player: PlayerLink | null };
export type ProfileTree = { mentors: ProfileTreeLink[]; mentees: ProfileTreeLink[]; peers: ProfileTreeLink[] };

const NO_YEARS: LinkYears = { ongoing: false, startYear: null, endYear: null, inferred: false, inferredFrom: null };

/**
 * The coach's coaching tree for the profile card (§8.4): getTree's buckets, each link annotated with
 * honest years from both people's stints at the edge's organization, a player relationship when one
 * played for the other, and ordered by tenure.
 */
export async function getProfileTree(personId: string): Promise<ProfileTree> {
  const org = aliasedTable(organizations, "edge_org");
  const edges = await db
    .select({
      kind: treeEdges.kind,
      mentorId: treeEdges.mentorId,
      menteeId: treeEdges.menteeId,
      orgId: treeEdges.orgId,
      startYear: treeEdges.startYear,
      endYear: treeEdges.endYear,
      orgSlug: org.slug,
      orgShortName: org.shortName,
    })
    .from(treeEdges)
    .innerJoin(org, eq(org.id, treeEdges.orgId))
    .where(or(eq(treeEdges.mentorId, personId), eq(treeEdges.menteeId, personId)))
    .orderBy(desc(treeEdges.endYear), desc(treeEdges.startYear));
  const otherIds = [...new Set(edges.map((e) => (e.mentorId === personId ? e.menteeId : e.mentorId)))];
  const [summaries, stints] = await Promise.all([getPeopleSummaries(otherIds), getYearStints([personId, ...otherIds])]);
  const tree = aggregateTree(personId, edges, summaries);

  const stintsByPerson = new Map<string, YearStint[]>();
  for (const t of stints) stintsByPerson.set(t.personId, [...(stintsByPerson.get(t.personId) ?? []), t]);
  const mine = stintsByPerson.get(personId) ?? [];
  const pairStints = (otherId: string) => [...mine, ...(stintsByPerson.get(otherId) ?? [])];

  const annotate = (bucket: keyof ProfileTree, l: TreeLink): ProfileTreeLink => {
    const otherId = l.person.id;
    const match = (e: (typeof edges)[number]) =>
      e.orgSlug === l.org.slug &&
      e.startYear === l.startYear &&
      e.endYear === l.endYear &&
      (bucket === "peers"
        ? e.kind === "worked_alongside" && ((e.mentorId === personId && e.menteeId === otherId) || (e.mentorId === otherId && e.menteeId === personId))
        : e.kind === "worked_under" && (bucket === "mentees" ? e.mentorId === personId && e.menteeId === otherId : e.mentorId === otherId && e.menteeId === personId));
    const edge = edges.find(match);
    const both = pairStints(otherId);
    const years = edge ? edgeYears(edge as EdgeRef, both) : NO_YEARS;
    const playedFor = playedUnder(otherId, personId, both);
    const coached = playedFor ? null : playedUnder(personId, otherId, both);
    const player: PlayerLink | null = playedFor ? { kind: "played_for", years: playedFor } : coached ? { kind: "coached", years: coached } : null;
    return { ...l, years, player };
  };
  return {
    mentors: tree.mentors.map((l) => annotate("mentors", l)).sort(byTenure),
    mentees: tree.mentees.map((l) => annotate("mentees", l)).sort(byTenure),
    peers: tree.peers.map((l) => annotate("peers", l)).sort(byTenure),
  };
}

/** getProfileTree, deduplicated per request. */
export const getProfileTreeCached = cache(getProfileTree);

export type ProgramCard = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  nickname: string | null;
  level: string | null;
  conference: string | null;
  conferenceAbbr: string | null;
  city: string | null;
  state: string | null;
  athleticsUrl: string | null;
  inRegistry: boolean;
  /** Current staff on the network (people whose current program this is; demo candidates excluded). */
  staffCount: number;
  openJobs: number;
  /** Open jobs that are sample listings created for the demo. */
  sampleJobs: number;
};

/** Rail: the coach's current program, with staff and open-job counts (§8.4 Current program). */
export async function getProgramCard(orgId: string): Promise<ProgramCard | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return null;
  const [[staff], [open]] = await Promise.all([
    // Fictional demo candidates are not staff anywhere: leave them out of the count.
    db.select({ n: sql<number>`count(*)::int` }).from(people).where(and(eq(people.currentOrgId, orgId), eq(people.isDemo, false))),
    db
      .select({
        n: sql<number>`count(*)::int`,
        sample: sql<number>`count(*) filter (where ${jobs.isDemo} or ${jobs.source} = 'sample')::int`,
      })
      .from(jobs)
      .where(and(eq(jobs.orgId, orgId), eq(jobs.status, "open"), await visibleJobs())),
  ]);
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    shortName: org.shortName,
    nickname: org.nickname,
    level: org.level,
    conference: org.conference,
    conferenceAbbr: org.conferenceAbbr,
    city: org.city || null,
    state: org.state || null,
    athleticsUrl: org.athleticsUrl || null,
    inRegistry: org.inRegistry,
    staffCount: staff?.n ?? 0,
    openJobs: open?.n ?? 0,
    sampleJobs: open?.sample ?? 0,
  };
}

export type SameTreeLink = {
  person: PersonSummary;
  /** The staff member of the coach's current program who connects them. */
  via: { id: string; slug: string; fullName: string; firstName: string };
  /** How the staff member and the person are connected. */
  relation: "via_coached" | "via_worked_under" | "alongside";
  orgShortName: string;
  /** What the shared seasons can honestly show (linkYears): no filled-in start years, inferred flagged. */
  years: LinkYears;
};

/**
 * Rail "Same tree" (§8.4): second-degree edges through the coach's current staff, at other
 * organizations, excluding the coach, the current staff and anyone already in the tree card.
 * Prefers one person per staff member, newest overlap first. Up to `limit`.
 */
export async function getSameTree(personId: string, currentOrgId: string, exclude: string[], limit = 3): Promise<SameTreeLink[]> {
  const staff = await db
    .select({ id: people.id, slug: people.slug, fullName: people.fullName, firstName: people.firstName })
    .from(people)
    .where(and(eq(people.currentOrgId, currentOrgId), ne(people.id, personId)));
  if (!staff.length) return [];
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const staffIds = [...staffById.keys()];
  const org = aliasedTable(organizations, "same_tree_org");
  const edges = await db
    .select({
      kind: treeEdges.kind,
      mentorId: treeEdges.mentorId,
      menteeId: treeEdges.menteeId,
      orgId: treeEdges.orgId,
      startYear: treeEdges.startYear,
      endYear: treeEdges.endYear,
      orgShortName: org.shortName,
    })
    .from(treeEdges)
    .innerJoin(org, eq(org.id, treeEdges.orgId))
    .where(and(ne(treeEdges.orgId, currentOrgId), or(inArray(treeEdges.mentorId, staffIds), inArray(treeEdges.menteeId, staffIds))))
    .orderBy(sql`${treeEdges.endYear} desc nulls last`, desc(treeEdges.startYear))
    .limit(300);

  const skip = new Set([personId, ...staffIds, ...exclude]);
  type Pick = Omit<SameTreeLink, "person" | "years"> & { personId: string; viaId: string; edge: EdgeRef };
  const candidates: Pick[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    const viaIsMentor = staffById.has(e.mentorId);
    const viaId = viaIsMentor ? e.mentorId : e.menteeId;
    const otherId = viaIsMentor ? e.menteeId : e.mentorId;
    if (skip.has(otherId) || seen.has(otherId)) continue;
    seen.add(otherId);
    const via = staffById.get(viaId)!;
    candidates.push({
      personId: otherId,
      viaId,
      via: { id: via.id, slug: via.slug, fullName: via.fullName, firstName: via.firstName || via.fullName.split(" ")[0] },
      relation: e.kind === "worked_alongside" ? "alongside" : viaIsMentor ? "via_coached" : "via_worked_under",
      orgShortName: e.orgShortName,
      edge: e,
    });
  }
  // One per staff member first, then fill.
  const picked: Pick[] = [];
  const usedVia = new Set<string>();
  for (const c of candidates) {
    if (picked.length >= limit) break;
    if (usedVia.has(c.viaId)) continue;
    usedVia.add(c.viaId);
    picked.push(c);
  }
  for (const c of candidates) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) picked.push(c);
  }
  const [summaries, stints] = await Promise.all([
    getPeopleSummaries(picked.map((p) => p.personId)),
    getYearStints(
      [...new Set(picked.flatMap((p) => [p.personId, p.viaId]))],
      [...new Set(picked.map((p) => p.edge.orgId))],
    ),
  ]);
  return picked.flatMap((c) => {
    const person = summaries.get(c.personId);
    const years = edgeYears(c.edge, stints);
    return person ? [{ via: c.via, relation: c.relation, orgShortName: c.orgShortName, years, person }] : [];
  });
}

/** FNV-1a over a string, for a stable per-profile rotation of rail lists. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Rail "People also viewed" (§8.4): head coaches in the same conference, excluding the person and anyone
 * already on the page (`exclude`: the tree card and Same tree), as getSameTree excludes the tree card.
 * There is no view data yet, so the card says what the list is. The order rotates per profile.
 */
export async function getAlsoViewed(personId: string, personSlug: string, conferenceAbbr: string, exclude: string[] = [], limit = 4): Promise<PersonSummary[]> {
  const skip = [...new Set([personId, ...exclude])];
  const rows = await db
    .select(personSummaryCols)
    .from(people)
    .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(people.roleGroup, "head_coach"), eq(organizations.conferenceAbbr, conferenceAbbr), notInArray(people.id, skip)))
    .orderBy(asc(organizations.shortName), asc(people.fullName))
    .limit(40);
  if (rows.length <= limit) return rows.map(toSummary);
  const start = hash(personSlug) % rows.length;
  return Array.from({ length: limit }, (_, i) => toSummary(rows[(start + i) % rows.length]));
}

export type AlmaMaterOrg = {
  slug: string;
  name: string;
  shortName: string;
  level: string | null;
  conference: string | null;
  conferenceAbbr: string | null;
  state: string | null;
  inRegistry: boolean;
};

/** The organization matching an alma mater string exactly (name or short name), if any. */
export async function getAlmaMaterOrg(name: string): Promise<AlmaMaterOrg | null> {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  const [org] = await db
    .select({
      slug: organizations.slug,
      name: organizations.name,
      shortName: organizations.shortName,
      level: organizations.level,
      conference: organizations.conference,
      conferenceAbbr: organizations.conferenceAbbr,
      state: organizations.state,
      inRegistry: organizations.inRegistry,
    })
    .from(organizations)
    .where(or(sql`lower(${organizations.name}) = ${lower}`, sql`lower(${organizations.shortName}) = ${lower}`))
    .orderBy(desc(organizations.inRegistry))
    .limit(1);
  return org ?? null;
}

export type ConnectionState = "none" | "pending" | "accepted";

/** Connection between two people, in either direction. */
export async function getConnectionState(a: string, b: string): Promise<ConnectionState> {
  const [row] = await db
    .select({ status: connections.status })
    .from(connections)
    .where(or(and(eq(connections.requesterId, a), eq(connections.addresseeId, b)), and(eq(connections.requesterId, b), eq(connections.addresseeId, a))))
    .limit(1);
  if (!row) return "none";
  return row.status === "accepted" ? "accepted" : "pending";
}

/** Minimal person lookup for server actions. */
export async function getPersonForAction(personId: string) {
  const [row] = await db
    .select({ id: people.id, slug: people.slug, fullName: people.fullName, firstName: people.firstName, claimed: people.claimed })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  return row ?? null;
}
