import "server-only";
import { and, asc, count, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations, people, tenures, treeEdges } from "@/db/schema";
import { escapeLike } from "./orgs";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";

/*
 * Jobs feature queries (/jobs, /jobs/[id], /employers/jobs/new). Server-only and typed; pages
 * never touch the database directly (ARCHITECTURE "App conventions").
 */

export const JOB_ROLE_GROUPS = ["head_coach", "coordinator", "position_coach", "ga_analyst", "support"] as const;
export type JobRoleGroup = (typeof JOB_ROLE_GROUPS)[number];

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
  org: JobOrg;
};

export type JobDetail = JobListItem & {
  description: string;
  location: string | null;
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

/** One page of open jobs matching the filters, newest first, with the total and the sample count. */
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
    .orderBy(desc(jobs.postedAt), desc(jobs.id))
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

/** One job with its organization (any status, so a closed listing still resolves). */
export async function getJobDetail(id: number): Promise<JobDetail | null> {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const [row] = await db
    .select({
      ...listCols,
      description: jobs.description,
      location: jobs.location,
      sourceUrl: jobs.sourceUrl,
      createdByUserId: jobs.createdByUserId,
      status: jobs.status,
    })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(eq(jobs.id, id))
    .limit(1);
  return row ?? null;
}

/** Current staff of a program on the network (head coach and coordinators first), plus the total. */
export async function getProgramPeople(orgId: string, limit = 6): Promise<{ people: PersonSummary[]; total: number }> {
  const order = sql`case ${people.roleGroup} when 'head_coach' then 0 when 'coordinator' then 1 when 'position_coach' then 2 when 'ga_analyst' then 3 else 4 end`;
  const [rows, [{ n }]] = await Promise.all([
    db
      .select(personSummaryCols)
      .from(people)
      .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(and(eq(people.currentOrgId, orgId), eq(people.isDemo, false)))
      .orderBy(order, asc(people.fullName))
      .limit(limit),
    db
      .select({ n: count() })
      .from(people)
      .where(and(eq(people.currentOrgId, orgId), eq(people.isDemo, false))),
  ]);
  return { people: rows.map(toSummary), total: n };
}

/** Open jobs at one organization (for the program card). */
export async function countOpenJobs(orgId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(jobs)
    .where(and(eq(jobs.orgId, orgId), eq(jobs.status, "open")));
  return n;
}

/** Up to `limit` other open jobs in the same role group (then the same unit), newest first. */
export async function getSimilarJobs(job: Pick<JobDetail, "id" | "roleGroup" | "unit">, limit = 3): Promise<JobListItem[]> {
  const rank = sql`case when ${jobs.roleGroup} = ${job.roleGroup} then 0 when ${jobs.unit} = ${job.unit ?? ""} then 1 else 2 end`;
  return db
    .select(listCols)
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(and(eq(jobs.status, "open"), ne(jobs.id, job.id), or(sql`${jobs.roleGroup} = ${job.roleGroup}`, job.unit ? sql`${jobs.unit} = ${job.unit}` : sql`false`)))
    .orderBy(rank, desc(jobs.postedAt))
    .limit(limit);
}

export type NetworkProof = { people: (PersonSummary & { asPlayer: boolean })[]; total: number };

/**
 * People in the viewer's coaching tree (worked under, alongside, or under them) who coached or
 * played at this organization: the "your network here" line on a job.
 */
export async function getNetworkProof(viewerPersonId: string, orgId: string, limit = 3): Promise<NetworkProof> {
  const related = db
    .select({
      id: sql<string>`case when ${treeEdges.mentorId} = ${viewerPersonId} then ${treeEdges.menteeId} else ${treeEdges.mentorId} end`.as("rid"),
    })
    .from(treeEdges)
    .where(or(eq(treeEdges.mentorId, viewerPersonId), eq(treeEdges.menteeId, viewerPersonId)))
    .as("related");
  const rows = await db
    .selectDistinctOn([people.id], { ...personSummaryCols, asPlayer: tenures.asPlayer })
    .from(tenures)
    .innerJoin(related, eq(related.id, tenures.personId))
    .innerJoin(people, eq(people.id, tenures.personId))
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(tenures.orgId, orgId), ne(tenures.personId, viewerPersonId)))
    .orderBy(people.id, asc(tenures.asPlayer));
  return { people: rows.slice(0, limit).map((r) => ({ ...toSummary(r), asPlayer: r.asPlayer })), total: rows.length };
}

/** The organization a demo employer posts for (the program card in the post-job form). */
export async function getEmployerOrg(orgId: string): Promise<JobOrg | null> {
  const [row] = await db.select(orgCols).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return row ?? null;
}
