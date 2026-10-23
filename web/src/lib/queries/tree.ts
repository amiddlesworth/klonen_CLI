import "server-only";
import { cache } from "react";
import { aliasedTable, and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures, treeEdges } from "@/db/schema";
import { CURRENT_SEASON } from "@/lib/brand";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";

/*
 * Coaching tree explorer /in/[slug]/tree (DESIGN.md §8.8). Builds on the same tree_edges that
 * getTree() in people.ts reads, but keeps every edge per person (a pair can overlap at two
 * programs), flags edges whose years rest on an inferred stint, and adds an optional second level:
 * the people the coach's mentors worked under, and the people who coached under the coach's mentees.
 */

export type TreeOrg = { id: string; slug: string; shortName: string; name: string; inRegistry: boolean };

/** One overlap between two coaches on the same staff. */
export type TreeEdge = {
  org: TreeOrg;
  startYear: number | null;
  endYear: number | null;
  /** Both coaches are on that staff in the current season. */
  isCurrent: boolean;
  /** At least one of the overlapping stints has years inferred from the bio, not stated in it. */
  inferred: boolean;
};

export type TreePerson = PersonSummary & { firstName: string };

/** A first-level member: every edge they share with the focal coach, most recent first. */
export type TreeMember = { person: TreePerson; edges: TreeEdge[] };

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
  /** Present when depth = 2. */
  second: { up: SecondLevelMember[]; down: SecondLevelMember[]; uniqueCount: number } | null;
  /** The focal coach's own record, to explain an empty tree honestly. */
  record: { coachingStints: number; datedStints: number; programs: number };
};

const edgeOrg = aliasedTable(organizations, "edge_org");

/**
 * True when the edge's first or last season comes from a stint whose years are inferred
 * (either coach, same org, overlapping seasons, years_explicit = false). The overlap starts at the
 * later start and ends at the earlier end, so only the stint that supplies a boundary matters; a
 * current stint's end is the current season, which the staff page states.
 */
const inferredSql = sql<boolean>`exists (
  select 1 from ${tenures} t
  where t.org_id = ${treeEdges.orgId}
    and t.person_id in (${treeEdges.mentorId}, ${treeEdges.menteeId})
    and t.as_player = false
    and t.years_explicit = false
    and t.start_year is not null
    and t.start_year <= coalesce(${treeEdges.endYear}, ${CURRENT_SEASON}::int)
    and coalesce(t.end_year, case when t.is_current then ${CURRENT_SEASON}::int else t.start_year end) >= coalesce(${treeEdges.startYear}, 0)
    and (t.start_year = ${treeEdges.startYear} or (not t.is_current and coalesce(t.end_year, t.start_year) = ${treeEdges.endYear}))
)`;

type EdgeRow = {
  kind: "worked_under" | "worked_alongside";
  mentorId: string;
  menteeId: string;
  startYear: number | null;
  endYear: number | null;
  inferred: boolean;
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
      inferred: inferredSql,
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

function toEdge(r: EdgeRow): TreeEdge {
  return {
    org: { id: r.orgId, slug: r.orgSlug, shortName: r.orgShortName, name: r.orgName, inRegistry: r.orgInRegistry },
    startYear: r.startYear,
    endYear: r.endYear,
    isCurrent: r.endYear !== null && r.endYear >= CURRENT_SEASON,
    inferred: !!r.inferred,
  };
}

/** Most recent overlap first. */
function byRecency(a: TreeEdge, b: TreeEdge): number {
  return (b.endYear ?? 0) - (a.endYear ?? 0) || (b.startYear ?? 0) - (a.startYear ?? 0);
}

/** Current overlaps first (longest-serving first), then past ones by how recently they ended. */
function memberOrder(a: { person: TreePerson; edges: TreeEdge[] }, b: { person: TreePerson; edges: TreeEdge[] }): number {
  const ea = a.edges[0];
  const eb = b.edges[0];
  if (ea.isCurrent !== eb.isCurrent) return ea.isCurrent ? -1 : 1;
  const byYears = ea.isCurrent
    ? (ea.startYear ?? 9999) - (eb.startYear ?? 9999)
    : (eb.endYear ?? 0) - (ea.endYear ?? 0) || (eb.startYear ?? 0) - (ea.startYear ?? 0);
  return byYears || a.person.fullName.localeCompare(b.person.fullName);
}

async function fetchPeople(ids: string[]): Promise<Map<string, TreePerson>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ ...personSummaryCols, firstName: people.firstName })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(inArray(people.id, ids));
  return new Map(rows.map((r) => [r.id, { ...toSummary(r), firstName: r.firstName?.trim() || r.fullName.split(/\s+/)[0] }]));
}

function collect(map: Map<string, TreeEdge[]>, id: string, edge: TreeEdge) {
  const list = map.get(id);
  if (list) list.push(edge);
  else map.set(id, [edge]);
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
  const edges = await fetchEdges(or(eq(treeEdges.mentorId, id), eq(treeEdges.menteeId, id)));
  const buckets = { mentors: new Map<string, TreeEdge[]>(), peers: new Map<string, TreeEdge[]>(), mentees: new Map<string, TreeEdge[]>() };
  for (const e of edges) {
    const other = e.mentorId === id ? e.menteeId : e.mentorId;
    if (other === id) continue;
    const bucket = e.kind === "worked_alongside" ? "peers" : e.mentorId === id ? "mentees" : "mentors";
    collect(buckets[bucket], other, toEdge(e));
  }

  // Second level (depth 2): mentors of mentors, mentees of mentees.
  const mentorIds = [...buckets.mentors.keys()];
  const menteeIds = [...buckets.mentees.keys()];
  const firstLevelIds = new Set([...buckets.mentors.keys(), ...buckets.peers.keys(), ...buckets.mentees.keys()]);
  let upRows: EdgeRow[] = [];
  let downRows: EdgeRow[] = [];
  if (depth === 2) {
    [upRows, downRows] = await Promise.all([
      mentorIds.length ? fetchEdges(and(eq(treeEdges.kind, "worked_under"), inArray(treeEdges.menteeId, mentorIds))) : Promise.resolve([]),
      menteeIds.length ? fetchEdges(and(eq(treeEdges.kind, "worked_under"), inArray(treeEdges.mentorId, menteeIds))) : Promise.resolve([]),
    ]);
    const skip = (other: string) => other === id || firstLevelIds.has(other);
    upRows = upRows.filter((e) => !skip(e.mentorId));
    downRows = downRows.filter((e) => !skip(e.menteeId));
  }

  const allIds = new Set<string>(firstLevelIds);
  for (const e of upRows) allIds.add(e.mentorId);
  for (const e of downRows) allIds.add(e.menteeId);
  const [peopleById, record] = await Promise.all([fetchPeople([...allIds]), loadRecord(id)]);

  const members = (map: Map<string, TreeEdge[]>): TreeMember[] =>
    [...map.entries()]
      .map(([pid, list]) => ({ person: peopleById.get(pid), edges: list.sort(byRecency) }))
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
        const via = viaOf(e);
        if (!byPerson.has(other)) byPerson.set(other, new Map());
        collect(byPerson.get(other)!, via, toEdge(e));
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
    second = { up, down, uniqueCount: new Set([...up, ...down].map((m) => m.person.id)).size };
  }

  return { focal, mentors, peers, mentees, uniqueCount: groupsOf.size, listedTwice, second, record };
}

async function loadRecord(personId: string): Promise<TreeExplorer["record"]> {
  const [r] = await db
    .select({
      coachingStints: sql<number>`count(*)::int`,
      datedStints: sql<number>`count(*) filter (where ${tenures.startYear} is not null)::int`,
      programs: sql<number>`count(distinct ${tenures.orgId})::int`,
    })
    .from(tenures)
    .where(and(eq(tenures.personId, personId), eq(tenures.asPlayer, false)));
  return r ?? { coachingStints: 0, datedStints: 0, programs: 0 };
}

/** The coach's tree for the explorer, deduplicated per request (generateMetadata and the page share it). */
export const getTreeExplorer = cache(loadTreeExplorer);
