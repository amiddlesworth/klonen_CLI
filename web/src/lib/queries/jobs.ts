import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations } from "@/db/schema";
import { toJobCard, type JobCardData } from "./feed";

export type JobFilters = { roleGroup?: string; state?: string; conference?: string; q?: string };

export async function listJobs(f: JobFilters = {}): Promise<JobCardData[]> {
  const where: SQL[] = [eq(jobs.status, "open")];
  if (f.roleGroup) where.push(sql`${jobs.roleGroup} = ${f.roleGroup}`);
  if (f.state) where.push(eq(organizations.state, f.state));
  if (f.conference) where.push(eq(organizations.conferenceAbbr, f.conference));
  if (f.q?.trim()) where.push(sql`(${jobs.title} ILIKE ${"%" + f.q.trim() + "%"} OR ${organizations.shortName} ILIKE ${"%" + f.q.trim() + "%"})`);
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      roleGroup: jobs.roleGroup,
      employmentType: jobs.employmentType,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      postedAt: jobs.postedAt,
      source: jobs.source,
      orgSlug: organizations.slug,
      orgShortName: organizations.shortName,
      orgNickname: organizations.nickname,
      orgConferenceAbbr: organizations.conferenceAbbr,
      orgState: organizations.state,
      orgLevel: organizations.level,
    })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(and(...where))
    .orderBy(desc(jobs.postedAt));
  return rows.map(toJobCard);
}

export async function getJob(id: number) {
  const [row] = await db
    .select({ job: jobs, org: organizations })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(eq(jobs.id, id))
    .limit(1);
  return row ?? null;
}
