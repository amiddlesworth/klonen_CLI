import "server-only";
import { cache } from "react";
import { aliasedTable, and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { connections, jobs, organizations, people, treeEdges } from "@/db/schema";
import { getPeopleSummaries, getProfile, getTree, personSummaryCols, toSummary, type PersonSummary } from "./people";

export type { ExperienceGroup, PersonSummary, Profile, TenureRow, Tree, TreeLink } from "./people";

/*
 * Extra queries for the coach profile /in/[slug] (DESIGN.md §8.4). The core record comes from
 * getProfile / getTree in people.ts; this file adds the rail cards and viewer-specific state.
 */

/** getProfile, deduplicated per request (generateMetadata and the page both need it). */
export const getProfileCached = cache(getProfile);

/** getTree, deduplicated per request. */
export const getTreeCached = cache(getTree);

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
  /** Current staff on the network (people whose current program this is). */
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
    db.select({ n: sql<number>`count(*)::int` }).from(people).where(eq(people.currentOrgId, orgId)),
    db
      .select({
        n: sql<number>`count(*)::int`,
        sample: sql<number>`count(*) filter (where ${jobs.isDemo} or ${jobs.source} = 'sample')::int`,
      })
      .from(jobs)
      .where(and(eq(jobs.orgId, orgId), eq(jobs.status, "open"))),
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
  via: { slug: string; fullName: string; firstName: string };
  /** How the staff member and the person are connected. */
  relation: "via_coached" | "via_worked_under" | "alongside";
  orgShortName: string;
  startYear: number | null;
  endYear: number | null;
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
  type Pick = Omit<SameTreeLink, "person"> & { personId: string; viaId: string };
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
      via: { slug: via.slug, fullName: via.fullName, firstName: via.firstName || via.fullName.split(" ")[0] },
      relation: e.kind === "worked_alongside" ? "alongside" : viaIsMentor ? "via_coached" : "via_worked_under",
      orgShortName: e.orgShortName,
      startYear: e.startYear,
      endYear: e.endYear,
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
  const summaries = await getPeopleSummaries(picked.map((p) => p.personId));
  return picked.flatMap((c) => {
    const person = summaries.get(c.personId);
    return person ? [{ via: c.via, relation: c.relation, orgShortName: c.orgShortName, startYear: c.startYear, endYear: c.endYear, person }] : [];
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
 * Rail "People also viewed" (§8.4): head coaches in the same conference, excluding the person.
 * There is no view data yet, so the card says what the list is. The order rotates per profile.
 */
export async function getAlsoViewed(personId: string, personSlug: string, conferenceAbbr: string, limit = 4): Promise<PersonSummary[]> {
  const rows = await db
    .select(personSummaryCols)
    .from(people)
    .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(people.roleGroup, "head_coach"), eq(organizations.conferenceAbbr, conferenceAbbr), ne(people.id, personId)))
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
