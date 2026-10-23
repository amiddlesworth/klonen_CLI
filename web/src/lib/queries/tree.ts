import "server-only";
import { cache } from "react";
import { aliasedTable, and, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures, treeEdges } from "@/db/schema";
import { CURRENT_SEASON } from "@/lib/brand";
import { coverage, edgeEligible, playedUnder, type LinkYears, type YearStint } from "@/components/profile/linkYears";
import { lineageRuns } from "@/components/tree/lineage";
import { treeEdgeYears, yearsDisplay, type EdgeYears } from "@/components/tree/years";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";

/*
 * Coaching tree explorer /in/[slug]/tree (DESIGN.md §8.8). Builds on the same tree_edges that
 * getTree() in people.ts reads, but keeps every edge per person (a pair can overlap at two programs or
 * in two runs), works out what each edge's years can honestly show from both people's stints (the
 * profile's linkYears rules: an undated current stint pins no start year; inferred bounds are flagged
 * with their evidence), and adds an optional second level in time order: the people the coach's head
 * coaches had worked under by then, and the people who later coached under the coach's former staff.
 */

export type TreeOrg = { id: string; slug: string; shortName: string; name: string; inRegistry: boolean };

/** One overlap between two coaches on the same staff. */
export type TreeEdge = {
  org: TreeOrg;
  /** The stored run (pipeline coverage; used for order, never shown as a fact on its own). */
  startYear: number | null;
  endYear: number | null;
  /** Both coaches are on that staff in the current season. */
  isCurrent: boolean;
  /** What the years can honestly show, per bound. */
  years: EdgeYears;
  /** A shown year is inferred from a bio, not stated in it. */
  inferred: boolean;
  /** Plain-words reasons for the inferred years, quoting the evidence (DESIGN.md §6.2). */
  reasons: string[];
  /** The staff side held only support roles there (operations, admin): word it "on staff", not "coached". */
  supportOnly: boolean;
};

export type TreePerson = PersonSummary & { firstName: string };

/**
 * A player relationship between the coach and a tree person, the profile tree card's rule
 * (getProfileTree, linkYears.playedUnder): "played_for" = the tree person played for the coach (as its
 * head coach); "coached" = the tree person was the coach's head coach while the coach played.
 */
export type TreePlayerLink = { kind: "played_for" | "coached"; years: EdgeYears; reasons: string[] };

/** A first-level member: every edge they share with the focal coach, most recent first. */
export type TreeMember = { person: TreePerson; edges: TreeEdge[]; player: TreePlayerLink | null };

/** A second-level member and the first-level people they connect through. */
export type SecondLevelMember = { person: TreePerson; links: { via: TreePerson; edges: TreeEdge[] }[] };

export type FocalCoach = TreePerson & {
  claimed: boolean;
  currentOrg: (TreeOrg & { level: string | null; conference: string | null; conferenceAbbr: string | null }) | null;
};

export type TreeExplorer = {
  focal: FocalCoach;
  mentors: TreeMember[];
  peers: TreeMember[];
  mentees: TreeMember[];
  /** Unique people across the three groups (the profile's "In coaching tree" stat). */
  uniqueCount: number;
  /** People who appear in two groups, with the groups they appear in. */
  listedTwice: { person: TreePerson; groups: ("mentors" | "peers" | "mentees")[] }[];
  /**
   * Present when depth = 2. `dropped` counts links on record that are left out because they are not in
   * time order (a head coach's own head coach from after coaching the coach, and so on), so an empty
   * band can say why instead of claiming there are no links.
   */
  second: { up: SecondLevelMember[]; down: SecondLevelMember[]; uniqueCount: number; dropped: { up: number; down: number } } | null;
  /** The focal coach's own record, to explain an empty tree honestly. */
  record: TreeRecord;
};

export type TreeRecord = {
  /** Football coaching stints that can form tree edges (resolve.py edge_eligible). */
  coachingStints: number;
  /** Of those, stints that cover at least one season (a current stint counts: it covers this season). */
  datedStints: number;
  programs: number;
  /** Titles of listed roles that are not coaching roles (role group "other"), which never form edges. */
  otherRoles: string[];
};

const edgeOrg = aliasedTable(organizations, "edge_org");

type EdgeRow = {
  kind: "worked_under" | "worked_alongside";
  mentorId: string;
  menteeId: string;
  startYear: number | null;
  endYear: number | null;
  orgId: string;
  orgSlug: string;
  orgShortName: string;
  orgName: string;
  orgInRegistry: boolean;
};

async function fetchEdges(where: SQL | undefined): Promise<EdgeRow[]> {
  return db
    .select({
      kind: treeEdges.kind,
      mentorId: treeEdges.mentorId,
      menteeId: treeEdges.menteeId,
      startYear: treeEdges.startYear,
      endYear: treeEdges.endYear,
      orgId: edgeOrg.id,
      orgSlug: edgeOrg.slug,
      orgShortName: edgeOrg.shortName,
      orgName: edgeOrg.name,
      orgInRegistry: edgeOrg.inRegistry,
    })
    .from(treeEdges)
    .innerJoin(edgeOrg, eq(edgeOrg.id, treeEdges.orgId))
    .where(where);
}

/** Every stint of these people (at these organizations, when given), as linkYears reads them. */
async function fetchStints(personIds: string[], orgIds?: string[]): Promise<YearStint[]> {
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

/** "Ian Falconer" → "Ian Falconer's" (no gendered pronouns: the bio is named by whose it is). */
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/** The reason under a dotted year (§6.2): whose bio it comes from, quoting the source phrase. */
function inferredReason(evidence: string | null, whose: string | undefined): string {
  const bio = whose ? `${possessive(whose)} staff bio` : "the staff bio";
  if (!evidence) return `from ${bio}, not stated in it`;
  const q = evidence.trim().replace(/^["“]|["”]$/g, "");
  return `from ${bio}, which says “${q.length > 160 ? `${q.slice(0, 157).trimEnd()}…` : q}”`;
}

/** Most recent run first. */
function byRecency(a: TreeEdge, b: TreeEdge): number {
  return (b.endYear ?? 0) - (a.endYear ?? 0) || (b.startYear ?? 0) - (a.startYear ?? 0);
}

/**
 * Order inside a group, the same as the profile's tree card (getProfileTree's byTenure): runs with years
 * first, by end (current first), then start (longest-serving first), then name; runs whose years the
 * source doesn't pin go last (current first, then name).
 */
function memberOrder(a: { person: TreePerson; edges: TreeEdge[] }, b: { person: TreePerson; edges: TreeEdge[] }): number {
  const ya = a.edges[0].years;
  const yb = b.edges[0].years;
  const ra = yearsDisplay(ya) === "range";
  const rb = yearsDisplay(yb) === "range";
  if (ra !== rb) return ra ? -1 : 1;
  if (ra) {
    const end = (y: EdgeYears) => (y.ongoing ? Infinity : (y.endYear ?? -Infinity));
    const e = end(yb) - end(ya);
    if (e) return e;
    const s = (ya.startYear ?? 0) - (yb.startYear ?? 0);
    if (s) return s;
  } else if (ya.ongoing !== yb.ongoing) return ya.ongoing ? -1 : 1;
  return a.person.fullName.localeCompare(b.person.fullName);
}

async function fetchPeople(ids: string[]): Promise<Map<string, TreePerson>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ ...personSummaryCols, firstName: people.firstName })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    // A fictional demo candidate is in no real coach's tree (members without a person are dropped).
    .where(and(inArray(people.id, ids), eq(people.isDemo, false)));
  return new Map(rows.map((r) => [r.id, { ...toSummary(r), firstName: r.firstName?.trim() || r.fullName.split(/\s+/)[0] }]));
}

function collect<T>(map: Map<string, T[]>, id: string, item: T) {
  const list = map.get(id);
  if (list) list.push(item);
  else map.set(id, [item]);
}

async function loadTreeExplorer(slug: string, depth: 1 | 2): Promise<TreeExplorer | null> {
  const [row] = await db
    .select({
      ...personSummaryCols,
      firstName: people.firstName,
      orgId: organizations.id,
      orgName: organizations.name,
      orgInRegistry: organizations.inRegistry,
      orgConference: organizations.conference,
    })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(eq(people.slug, slug))
    .limit(1);
  if (!row) return null;

  const focal: FocalCoach = {
    ...toSummary(row),
    firstName: row.firstName?.trim() || row.fullName.split(/\s+/)[0],
    currentOrg:
      row.orgId && row.orgSlug
        ? {
            id: row.orgId,
            slug: row.orgSlug,
            shortName: row.orgShortName ?? row.orgName ?? "",
            name: row.orgName ?? row.orgShortName ?? "",
            inRegistry: !!row.orgInRegistry,
            level: row.orgLevel,
            conference: row.orgConference,
            conferenceAbbr: row.orgConferenceAbbr,
          }
        : null,
  };
  const id = focal.id;

  // First level: every edge that touches the focal coach.
  const edges = (await fetchEdges(or(eq(treeEdges.mentorId, id), eq(treeEdges.menteeId, id)))).filter((e) => e.mentorId !== e.menteeId);
  const buckets = { mentors: new Map<string, EdgeRow[]>(), peers: new Map<string, EdgeRow[]>(), mentees: new Map<string, EdgeRow[]>() };
  for (const e of edges) {
    const other = e.mentorId === id ? e.menteeId : e.mentorId;
    const bucket = e.kind === "worked_alongside" ? "peers" : e.mentorId === id ? "mentees" : "mentors";
    collect(buckets[bucket], other, e);
  }

  // Second level (depth 2): head coaches the coach's head coaches had worked under by then, and coaches
  // who later worked under the coach's former staff (lineage.ts keeps only links in time order).
  const firstLevelIds = new Set([...buckets.mentors.keys(), ...buckets.peers.keys(), ...buckets.mentees.keys()]);
  let upRows: EdgeRow[] = [];
  let downRows: EdgeRow[] = [];
  let dropped = { up: 0, down: 0 };
  if (depth === 2) {
    const mentorIds = [...buckets.mentors.keys()];
    const menteeIds = [...buckets.mentees.keys()];
    [upRows, downRows] = await Promise.all([
      mentorIds.length ? fetchEdges(and(eq(treeEdges.kind, "worked_under"), inArray(treeEdges.menteeId, mentorIds))) : Promise.resolve([]),
      menteeIds.length ? fetchEdges(and(eq(treeEdges.kind, "worked_under"), inArray(treeEdges.mentorId, menteeIds))) : Promise.resolve([]),
    ]);
    const skip = (other: string) => other === id || firstLevelIds.has(other);
    const upAll = upRows.filter((e) => !skip(e.mentorId));
    const downAll = downRows.filter((e) => !skip(e.menteeId));
    upRows = upAll.filter((e) => lineageRuns("up", buckets.mentors.get(e.menteeId) ?? [], [e]).length > 0);
    downRows = downAll.filter((e) => lineageRuns("down", buckets.mentees.get(e.mentorId) ?? [], [e]).length > 0);
    dropped = { up: upAll.length - upRows.length, down: downAll.length - downRows.length };
  }

  const allIds = new Set<string>(firstLevelIds);
  for (const e of upRows) allIds.add(e.mentorId);
  for (const e of downRows) allIds.add(e.menteeId);
  const orgIds = new Set([...edges, ...upRows, ...downRows].map((e) => e.orgId));
  // The coach and the first level: every stint (a player relationship can be at any program). The
  // second level: only stints at the programs of their links.
  const secondIds = [...allIds].filter((pid) => !firstLevelIds.has(pid));
  const [peopleById, firstStints, secondStints, record] = await Promise.all([
    fetchPeople([...allIds]),
    fetchStints([id, ...firstLevelIds]),
    fetchStints(secondIds, [...orgIds]),
    loadRecord(id),
  ]);
  const stints = [...firstStints, ...secondStints];
  const nameOf = (pid: string) => (pid === id ? focal.fullName : peopleById.get(pid)?.fullName);

  const stintsByPair = (a: string, b: string, orgId: string) => stints.filter((t) => t.orgId === orgId && (t.personId === a || t.personId === b));
  const toEdge = (r: EdgeRow): TreeEdge => {
    const pair = stintsByPair(r.mentorId, r.menteeId, r.orgId);
    const years = treeEdgeYears(r, pair);
    // The staff side of a "worked under" run (or either side of "alongside") held only support roles.
    const staffIds = r.kind === "worked_under" ? [r.menteeId] : [r.mentorId, r.menteeId];
    const lo = r.startYear ?? r.endYear ?? CURRENT_SEASON;
    const hi = r.endYear ?? r.startYear ?? CURRENT_SEASON;
    const during = pair.filter((t) => {
      const c = coverage(t);
      return staffIds.includes(t.personId) && edgeEligible(t) && t.roleGroup !== "head_coach" && !!c && c[0] <= hi && c[1] >= lo;
    });
    return {
      org: { id: r.orgId, slug: r.orgSlug, shortName: r.orgShortName, name: r.orgName, inRegistry: r.orgInRegistry },
      startYear: r.startYear,
      endYear: r.endYear,
      isCurrent: r.endYear !== null && r.endYear >= CURRENT_SEASON,
      years,
      inferred: years.startInferred || years.endInferred,
      reasons: [...new Set(years.inferredFrom.map((f) => inferredReason(f.evidence, nameOf(f.personId))))],
      supportOnly: r.kind === "worked_under" && during.length > 0 && during.every((t) => t.roleGroup === "support"),
    };
  };

  // Player relationships, exactly as the profile's tree card checks them (getProfileTree).
  const toRun = (y: LinkYears): EdgeYears => {
    const startInferred = y.startInferred ?? y.inferred;
    const endInferred = !!y.endInferred;
    const from = [startInferred ? (y.startFrom ?? y.inferredFrom) : null, endInferred ? y.endFrom : null];
    return { ongoing: y.ongoing, startYear: y.startYear, endYear: y.endYear, startInferred, endInferred, inferredFrom: from.filter((f): f is NonNullable<typeof f> => !!f) };
  };
  const playerLink = (otherId: string): TreePlayerLink | null => {
    const both = stints.filter((t) => t.personId === id || t.personId === otherId);
    const playedFor = playedUnder(otherId, id, both);
    const coached = playedFor ? null : playedUnder(id, otherId, both);
    const link = playedFor ? { kind: "played_for" as const, y: playedFor } : coached ? { kind: "coached" as const, y: coached } : null;
    if (!link) return null;
    const years = toRun(link.y);
    return { kind: link.kind, years, reasons: [...new Set(years.inferredFrom.map((f) => inferredReason(f.evidence, nameOf(f.personId))))] };
  };

  const members = (map: Map<string, EdgeRow[]>): TreeMember[] =>
    [...map.entries()]
      .map(([pid, list]) => ({ person: peopleById.get(pid), edges: list.map(toEdge).sort(byRecency), player: playerLink(pid) }))
      .filter((m): m is TreeMember => !!m.person)
      .sort(memberOrder);
  const mentors = members(buckets.mentors);
  const peers = members(buckets.peers);
  const mentees = members(buckets.mentees);

  const groupsOf = new Map<string, ("mentors" | "peers" | "mentees")[]>();
  for (const [key, list] of [["mentors", mentors], ["peers", peers], ["mentees", mentees]] as const) {
    for (const m of list) groupsOf.set(m.person.id, [...(groupsOf.get(m.person.id) ?? []), key]);
  }
  const listedTwice = [...groupsOf.entries()]
    .filter(([, g]) => g.length > 1)
    .map(([pid, groups]) => ({ person: peopleById.get(pid)!, groups }))
    .filter((x) => !!x.person);

  let second: TreeExplorer["second"] = null;
  if (depth === 2) {
    const build = (rows: EdgeRow[], otherOf: (e: EdgeRow) => string, viaOf: (e: EdgeRow) => string): SecondLevelMember[] => {
      const byPerson = new Map<string, Map<string, TreeEdge[]>>();
      for (const e of rows) {
        const other = otherOf(e);
        if (!byPerson.has(other)) byPerson.set(other, new Map());
        collect(byPerson.get(other)!, viaOf(e), toEdge(e));
      }
      return [...byPerson.entries()]
        .map(([pid, vias]) => ({
          person: peopleById.get(pid)!,
          links: [...vias.entries()]
            .map(([vid, list]) => ({ via: peopleById.get(vid)!, edges: list.sort(byRecency) }))
            .filter((l) => !!l.via)
            .sort((a, b) => byRecency(a.edges[0], b.edges[0])),
        }))
        .filter((m) => !!m.person && m.links.length > 0)
        .sort((a, b) => memberOrder({ person: a.person, edges: a.links[0].edges }, { person: b.person, edges: b.links[0].edges }));
    };
    const up = build(upRows, (e) => e.mentorId, (e) => e.menteeId);
    const down = build(downRows, (e) => e.menteeId, (e) => e.mentorId);
    second = { up, down, uniqueCount: new Set([...up, ...down].map((m) => m.person.id)).size, dropped };
  }

  return { focal, mentors, peers, mentees, uniqueCount: groupsOf.size, listedTwice, second, record };
}

/** The coach's own stints, counted the way the pipeline builds edges (resolve.py edge_eligible and span). */
async function loadRecord(personId: string): Promise<TreeRecord> {
  const rows = await db
    .select({
      orgId: tenures.orgId,
      role: tenures.role,
      roleGroup: tenures.roleGroup,
      sport: tenures.sport,
      startYear: tenures.startYear,
      endYear: tenures.endYear,
      isCurrent: tenures.isCurrent,
      asPlayer: tenures.asPlayer,
    })
    .from(tenures)
    .where(eq(tenures.personId, personId));
  const coaching = rows.filter((t) => !t.asPlayer && t.sport === "football" && t.roleGroup !== "other" && t.roleGroup !== "player");
  const dated = coaching.filter((t) => t.isCurrent || t.startYear !== null || t.endYear !== null);
  const otherRoles = [...new Set(rows.filter((t) => !t.asPlayer && t.roleGroup === "other").map((t) => t.role.trim()))].filter(Boolean);
  return { coachingStints: coaching.length, datedStints: dated.length, programs: new Set(coaching.map((t) => t.orgId)).size, otherRoles };
}

/** The coach's tree for the explorer, deduplicated per request (generateMetadata and the page share it). */
export const getTreeExplorer = cache(loadTreeExplorer);

/** Whether a coach lives at this slug: the route layout's check, so an unknown slug is a real 404. */
export const treeCoachExists = cache(async (slug: string): Promise<boolean> => {
  const [row] = await db.select({ id: people.id }).from(people).where(eq(people.slug, slug)).limit(1);
  return !!row;
});
