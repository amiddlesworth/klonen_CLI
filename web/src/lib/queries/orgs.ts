import "server-only";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations, people, tenures } from "@/db/schema";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";

export type StaffUnit = "head" | "offense" | "defense" | "special_teams" | "support";

export const STAFF_UNIT_LABEL: Record<StaffUnit, string> = {
  head: "Head coach",
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special teams",
  support: "Support staff",
};

export async function getOrg(slug: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return org ?? null;
}

/** Current staff grouped by unit, head coach first. */
export async function getStaff(orgId: string): Promise<{ unit: StaffUnit; people: PersonSummary[] }[]> {
  const rows = await db
    .select({ ...personSummaryCols, unit: people.unit })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(eq(people.currentOrgId, orgId))
    .orderBy(asc(people.fullName));
  const order: Record<string, number> = { head_coach: 0, coordinator: 1, position_coach: 2, ga_analyst: 3, support: 4, other: 5 };
  rows.sort((a, b) => (order[a.roleGroup ?? "other"] ?? 9) - (order[b.roleGroup ?? "other"] ?? 9));
  const buckets: Record<StaffUnit, PersonSummary[]> = { head: [], offense: [], defense: [], special_teams: [], support: [] };
  for (const r of rows) {
    const u: StaffUnit =
      r.roleGroup === "head_coach" ? "head"
      : r.unit === "offense" ? "offense"
      : r.unit === "defense" ? "defense"
      : r.unit === "special_teams" ? "special_teams"
      : "support";
    buckets[u].push(toSummary(r));
  }
  return (Object.keys(buckets) as StaffUnit[]).filter((u) => buckets[u].length).map((u) => ({ unit: u, people: buckets[u] }));
}

/** People who coached at this organization in the past and where they are now. */
export async function getAlumni(orgId: string, limit = 60) {
  const rows = await db
    .selectDistinctOn([people.id], {
      ...personSummaryCols,
      role: tenures.role,
      startYear: tenures.startYear,
      endYear: tenures.endYear,
    })
    .from(tenures)
    .innerJoin(people, eq(people.id, tenures.personId))
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(tenures.orgId, orgId), eq(tenures.isCurrent, false), eq(tenures.asPlayer, false), or(ne(people.currentOrgId, orgId), sql`${people.currentOrgId} is null`)))
    .orderBy(people.id, desc(tenures.endYear))
    .limit(limit);
  return rows
    .map((r) => ({ person: toSummary(r), role: r.role, startYear: r.startYear, endYear: r.endYear }))
    .sort((a, b) => (b.endYear ?? b.startYear ?? 0) - (a.endYear ?? a.startYear ?? 0));
}

export async function getOrgJobs(orgId: string) {
  return db.select().from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.status, "open"))).orderBy(desc(jobs.postedAt));
}

export async function searchOrgs(q: string, limit = 8) {
  const like = `%${q}%`;
  return db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      shortName: organizations.shortName,
      nickname: organizations.nickname,
      conferenceAbbr: organizations.conferenceAbbr,
      state: organizations.state,
      level: organizations.level,
    })
    .from(organizations)
    .where(and(eq(organizations.inRegistry, true), or(ilike(organizations.name, like), ilike(organizations.shortName, like), ilike(organizations.nickname, like))))
    .orderBy(asc(organizations.shortName))
    .limit(limit);
}

export async function listConferences() {
  const rows = await db
    .selectDistinct({ abbr: organizations.conferenceAbbr })
    .from(organizations)
    .where(and(eq(organizations.inRegistry, true), sql`${organizations.conferenceAbbr} is not null`))
    .orderBy(asc(organizations.conferenceAbbr));
  return rows.map((r) => r.abbr!);
}
