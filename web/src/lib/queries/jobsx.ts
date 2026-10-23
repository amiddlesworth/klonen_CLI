import "server-only";
import { cache } from "react";
import { and, asc, count, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations, people, tenures, treeEdges } from "@/db/schema";
import { JOB_ROLE_GROUPS, type JobRoleGroup } from "@/components/jobs/labels";
import { escapeLike } from "./orgs";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";
import { getProgramAlumni, getProgramPlayers, type AlumniEntry } from "./program";

/** Header and tab counts of the program page, reused for the job rail so both show the same numbers. */
export { getProgramCounts, type ProgramCounts } from "./program";

/*
 * Jobs feature queries (/jobs, /jobs/[id], /employers/jobs/new). Server-only and typed; pages
 * never touch the database directly (ARCHITECTURE "App conventions").
 */

export { JOB_ROLE_GROUPS, type JobRoleGroup };

export const JOBS_PAGE_SIZE = 20;

export type JobOrg = {
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
};

export type JobListItem = {
  id: number;
  title: string;
  roleGroup: string;
  unit: string | null;
  employmentType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: Date;
  source: "sample" | "native" | "aggregated";
  isDemo: boolean;
  /** "City, ST" as posted (native listings), or the state alone (samples); null when unknown. */
  location: string | null;
  org: JobOrg;
};

export type JobDetail = JobListItem & {
  description: string;
  sourceUrl: string | null;
  createdByUserId: string | null;
  status: string;
};

/** Filters from the URL. Each list is OR'ed inside the group; groups are AND'ed. */
export type JobsFilter = {
  roles: string[];
  states: string[];
  conferences: string[];
  q: string;
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
  city: organizations.city,
  state: organizations.state,
  athleticsUrl: organizations.athleticsUrl,
  inRegistry: organizations.inRegistry,
};

const listCols = {
  id: jobs.id,
  title: jobs.title,
  roleGroup: jobs.roleGroup,
  unit: jobs.unit,
  employmentType: jobs.employmentType,
  salaryMin: jobs.salaryMin,
  salaryMax: jobs.salaryMax,
  postedAt: jobs.postedAt,
  source: jobs.source,
  isDemo: jobs.isDemo,
  location: jobs.location,
  org: orgCols,
};

/** Conference abbreviation without the footnote markers left over from source tables ("NJAC[r]" -> "NJAC"). */
const confClean = sql<string>`nullif(trim(regexp_replace(coalesce(${organizations.conferenceAbbr}, ''), '\\[[^\\]]*\\]', '', 'g')), '')`;

function whereFor(f: JobsFilter, skip?: "roles" | "states" | "conferences"): SQL | undefined {
  const where: SQL[] = [eq(jobs.status, "open")];
  const roles = f.roles.filter((r): r is JobRoleGroup => (JOB_ROLE_GROUPS as readonly string[]).includes(r));
  if (skip !== "roles" && roles.length) where.push(inArray(jobs.roleGroup, roles));
  if (skip !== "states" && f.states.length) where.push(inArray(organizations.state, f.states));
  if (skip !== "conferences" && f.conferences.length) where.push(sql`${confClean} in (${sql.join(f.conferences.map((c) => sql`${c}`), sql`, `)})`);
  const q = f.q.trim();
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(
      or(
        sql`${jobs.title} ilike ${like}`,
        sql`${organizations.shortName} ilike ${like}`,
        sql`${organizations.name} ilike ${like}`,
        sql`${organizations.nickname} ilike ${like}`,
        sql`${organizations.conferenceAbbr} ilike ${like}`,
      )!,
    );
  }
  return and(...where);
}

/**
 * List order. Only listings someone posted (source "native") carry a real posted_at, so they come
 * first, newest first. Seeded sample listings have invented timestamps (§11 rule 6), so they never
 * sort by them: they follow in a stable order, most senior role group first, then program and title.
 */
const listOrder = [
  sql`case when ${jobs.source} = 'native' then 0 else 1 end`,
  sql`case when ${jobs.source} = 'native' then ${jobs.postedAt} end desc nulls last`,
  sql`case ${jobs.roleGroup} when 'head_coach' then 0 when 'coordinator' then 1 when 'position_coach' then 2 when 'ga_analyst' then 3 else 4 end`,
  asc(organizations.shortName),
  asc(jobs.title),
  asc(jobs.id),
];

/** One page of open jobs matching the filters (posted listings newest first, then samples), with the total and the sample count. */
export async function searchJobs(f: JobsFilter, page = 1): Promise<{ jobs: JobListItem[]; total: number; samples: number; page: number; totalPages: number }> {
  const where = whereFor(f);
  const [totals] = await db
    .select({ total: count(), samples: sql<number>`count(*) filter (where ${jobs.isDemo} or ${jobs.source} = 'sample')::int` })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(where);
  const total = totals?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));
  const p = Math.min(Math.max(1, page), totalPages);
  const rows = await db
    .select(listCols)
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(where)
    .orderBy(...listOrder)
    .limit(JOBS_PAGE_SIZE)
    .offset((p - 1) * JOBS_PAGE_SIZE);
  return { jobs: rows, total, samples: totals?.samples ?? 0, page: p, totalPages };
}

export type FacetOption = { value: string; label: string; count: number };
export type JobFacets = { roles: FacetOption[]; states: FacetOption[]; conferences: FacetOption[] };

/**
 * Options for the three filter menus, counted against the other active filters (a facet never
 * narrows itself), so every option shows how many jobs choosing it would add.
 */
export async function getJobFacets(f: JobsFilter, roleLabel: (v: string) => string): Promise<JobFacets> {
  const base = (skip: "roles" | "states" | "conferences") => whereFor(f, skip);
  const [roles, states, confs] = await Promise.all([
    db
      .select({ value: jobs.roleGroup, n: count() })
      .from(jobs)
      .innerJoin(organizations, eq(organizations.id, jobs.orgId))
      .where(base("roles"))
      .groupBy(jobs.roleGroup),
    db
      .select({ value: organizations.state, n: count() })
      .from(jobs)
      .innerJoin(organizations, eq(organizations.id, jobs.orgId))
      .where(base("states"))
      .groupBy(organizations.state)
      .orderBy(asc(organizations.state)),
    db
      .select({ value: confClean, n: count() })
      .from(jobs)
      .innerJoin(organizations, eq(organizations.id, jobs.orgId))
      .where(base("conferences"))
      .groupBy(confClean)
      .orderBy(confClean),
  ]);
  const roleCounts = new Map(roles.map((r) => [r.value as string, r.n]));
  return {
    roles: JOB_ROLE_GROUPS.map((v) => ({ value: v, label: roleLabel(v), count: roleCounts.get(v) ?? 0 })),
    states: states.filter((s) => s.value).map((s) => ({ value: s.value!, label: s.value!, count: s.n })),
    conferences: confs.filter((c) => c.value).map((c) => ({ value: c.value, label: c.value, count: c.n })),
  };
}

/**
 * One job with its organization (any status, so a closed listing still resolves). Cached per
 * request: the [id] layout checks existence (a real 404 before streaming) and the page reads it again.
 */
export const getJobDetail = cache(async (id: number): Promise<JobDetail | null> => {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const [row] = await db
    .select({
      ...listCols,
      description: jobs.description,
      sourceUrl: jobs.sourceUrl,
      createdByUserId: jobs.createdByUserId,
      status: jobs.status,
    })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(eq(jobs.id, id))
    .limit(1);
  return row ?? null;
});

/**
 * Current staff of a program on the network (head coach and coordinators first), plus the total.
 * `excludePersonId` leaves the viewer out of both (a coach's own program).
 */
export async function getProgramPeople(orgId: string, limit = 6, excludePersonId?: string | null): Promise<{ people: PersonSummary[]; total: number }> {
  const order = sql`case ${people.roleGroup} when 'head_coach' then 0 when 'coordinator' then 1 when 'position_coach' then 2 when 'ga_analyst' then 3 else 4 end`;
  const where = and(eq(people.currentOrgId, orgId), eq(people.isDemo, false), excludePersonId ? ne(people.id, excludePersonId) : undefined);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select(personSummaryCols)
      .from(people)
      .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(where)
      .orderBy(order, asc(people.fullName))
      .limit(limit),
    db.select({ n: count() }).from(people).where(where),
  ]);
  return { people: rows.map(toSummary), total: n };
}

/** A person who coached or played at the program, with every stint there (for "2003, 2006–2009"). */
export type ProgramAlumnus = Pick<AlumniEntry, "person" | "role" | "stints" | "inferred" | "inferredEvidence">;

export type ProgramNetwork = {
  /** Current staff (without the viewer), up to the limit, and the total. */
  staff: PersonSummary[];
  staffTotal: number;
  /** True when the viewer is on this staff and was left out of the rows and the total. */
  viewerOnStaff: boolean;
  /** People who coached here before their current job (the program page's Alumni coaches tab). */
  alumni: ProgramAlumnus[];
  alumniTotal: number;
  /** People who played here and now coach. */
  players: ProgramAlumnus[];
  playersTotal: number;
};

const toAlumnus = (e: AlumniEntry): ProgramAlumnus => ({ person: e.person, role: e.role, stints: e.stints, inferred: e.inferred, inferredEvidence: e.inferredEvidence });

/**
 * Everyone on the network with a tie to the hiring program: its current staff, its alumni coaches
 * and the former players who now coach. Alumni and players reuse the program page's grouping
 * (lib/queries/program.ts), so the totals equal that page's tab counts.
 */
export async function getProgramNetwork(
  orgId: string,
  { viewerPersonId = null, staffLimit = 6, alumniLimit = 4, playersLimit = 4 }: { viewerPersonId?: string | null; staffLimit?: number; alumniLimit?: number; playersLimit?: number } = {},
): Promise<ProgramNetwork> {
  const [staff, allStaff, alumni, players] = await Promise.all([
    getProgramPeople(orgId, staffLimit, viewerPersonId),
    viewerPersonId ? getProgramPeople(orgId, 0) : Promise.resolve(null),
    getProgramAlumni(orgId),
    getProgramPlayers(orgId),
  ]);
  const notViewer = (e: AlumniEntry) => e.person.id !== viewerPersonId;
  const alumniRows = alumni.filter(notViewer);
  const playerRows = players.filter(notViewer);
  return {
    staff: staff.people,
    staffTotal: staff.total,
    viewerOnStaff: !!allStaff && allStaff.total > staff.total,
    alumni: alumniRows.slice(0, alumniLimit).map(toAlumnus),
    alumniTotal: alumniRows.length,
    players: playerRows.slice(0, playersLimit).map(toAlumnus),
    playersTotal: playerRows.length,
  };
}

/** Words that say nothing about the role ("Coach", "Assistant"), left out when comparing titles. */
const TITLE_STOP = new Set(["coach", "coaches", "assistant", "asst", "and", "the", "of", "for", "a", "an", "to"]);

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 1 && !TITLE_STOP.has(w)),
  );
}

/**
 * Up to `limit` other open jobs like this one: the same role group and unit first, then the same
 * role group, then the same unit; within a tier, more title words in common first ("Linebackers
 * Coach / Recruiting Coordinator" finds its twins), then posted listings by their real date, then a
 * stable order (sample timestamps are invented, so they never rank).
 */
export async function getSimilarJobs(job: Pick<JobDetail, "id" | "roleGroup" | "unit" | "title">, limit = 3): Promise<JobListItem[]> {
  const rows = await db
    .select(listCols)
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(and(eq(jobs.status, "open"), ne(jobs.id, job.id), or(sql`${jobs.roleGroup} = ${job.roleGroup}`, job.unit ? sql`${jobs.unit} = ${job.unit}` : sql`false`)))
    .limit(200);
  const mine = titleTokens(job.title);
  const scored = rows.map((j) => {
    const sameRole = j.roleGroup === job.roleGroup;
    const sameUnit = !!job.unit && j.unit === job.unit;
    const tier = sameRole && sameUnit ? 0 : sameRole ? 1 : 2;
    let overlap = 0;
    for (const w of titleTokens(j.title)) if (mine.has(w)) overlap++;
    return { j, tier, overlap, posted: j.source === "native" ? j.postedAt.getTime() : -1 };
  });
  scored.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.overlap - a.overlap ||
      b.posted - a.posted ||
      a.j.org.shortName.localeCompare(b.j.org.shortName) ||
      a.j.title.localeCompare(b.j.title) ||
      a.j.id - b.j.id,
  );
  return scored.slice(0, limit).map((s) => s.j);
}

export type NetworkProofPerson = PersonSummary & {
  /** Every stint of theirs at this organization was as a player. */
  asPlayer: boolean;
  /** How they relate to the viewer: worked under (mentor), coached under the viewer (mentee), or alongside (peer). */
  relation: "mentor" | "mentee" | "peer";
  /** They are this organization's current head coach. */
  headCoachHere: boolean;
};
/** The closest `limit` people, how many there are in all, and how many of those only played here. */
export type NetworkProof = { people: NetworkProofPerson[]; total: number; playersOnly: number };

const RELATION_RANK = { mentor: 0, mentee: 1, peer: 2 } as const;

/**
 * People in the viewer's coaching tree (worked under, alongside, or under them) who coached or
 * played at this organization: the "your network here" line on a job. Ordered by how close the
 * tie is (people the viewer worked under first, then people who coached under the viewer, then
 * peers), then by the most recent season they overlapped, then by name. The viewer is never listed.
 */
export async function getNetworkProof(viewerPersonId: string, orgId: string, limit = 3): Promise<NetworkProof> {
  const related = db
    .select({
      rid: sql<string>`case when ${treeEdges.mentorId} = ${viewerPersonId} then ${treeEdges.menteeId} else ${treeEdges.mentorId} end`.as("rid"),
      relation: sql<"mentor" | "mentee" | "peer">`case when ${treeEdges.kind} = 'worked_alongside' then 'peer' when ${treeEdges.menteeId} = ${viewerPersonId} then 'mentor' else 'mentee' end`.as("relation"),
      lastYear: sql<number | null>`coalesce(${treeEdges.endYear}, ${treeEdges.startYear})`.as("last_year"),
    })
    .from(treeEdges)
    .where(or(eq(treeEdges.mentorId, viewerPersonId), eq(treeEdges.menteeId, viewerPersonId)))
    .as("related");
  const rows = await db
    .select({ ...personSummaryCols, currentOrgId: people.currentOrgId, asPlayer: tenures.asPlayer, relation: related.relation, lastYear: related.lastYear })
    .from(tenures)
    .innerJoin(related, eq(related.rid, tenures.personId))
    .innerJoin(people, eq(people.id, tenures.personId))
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(tenures.orgId, orgId), ne(tenures.personId, viewerPersonId), eq(people.isDemo, false)));

  const byPerson = new Map<string, { person: NetworkProofPerson; rank: number; last: number }>();
  for (const r of rows) {
    const rank = RELATION_RANK[r.relation];
    const last = r.lastYear ?? -1;
    const cur = byPerson.get(r.id);
    if (!cur) {
      const person = { ...toSummary(r), asPlayer: r.asPlayer, relation: r.relation, headCoachHere: r.roleGroup === "head_coach" && r.currentOrgId === orgId };
      byPerson.set(r.id, { person, rank, last });
      continue;
    }
    cur.person.asPlayer = cur.person.asPlayer && r.asPlayer;
    if (rank < cur.rank) {
      cur.rank = rank;
      cur.person.relation = r.relation;
    }
    cur.last = Math.max(cur.last, last);
  }
  const ordered = [...byPerson.values()].sort((a, b) => a.rank - b.rank || b.last - a.last || a.person.fullName.localeCompare(b.person.fullName));
  return { people: ordered.slice(0, limit).map((o) => o.person), total: ordered.length, playersOnly: ordered.filter((o) => o.person.asPlayer).length };
}

/** The organization a demo employer posts for (the program card in the post-job form). */
export async function getEmployerOrg(orgId: string): Promise<JobOrg | null> {
  const [row] = await db.select(orgCols).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return row ?? null;
}
