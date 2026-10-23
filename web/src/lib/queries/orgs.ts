import "server-only";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations, people, tenures } from "@/db/schema";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";
import { visibleJobs } from "@/lib/demo-scope";

export type StaffUnit = "head" | "offense" | "defense" | "special_teams" | "support";

export const STAFF_UNIT_LABEL: Record<StaffUnit, string> = {
  head: "Head coach",
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special teams",
  support: "Support staff",
};

/**
 * The conference abbreviation without footnote markers left over from source tables ("NACC[g]" -> "NACC"),
 * null when empty. Compare, filter and group on this so a marker never splits a conference; the display
 * equivalent is conferenceShort() in lib/format.ts. The regex is inlined (not a bind parameter) so the
 * expression is textually identical in SELECT and GROUP BY.
 */
export const conferenceKey = sql<string | null>`nullif(btrim(regexp_replace(${organizations.conferenceAbbr}, '\\[[^]]*\\]', '', 'g')), '')`;

export async function getOrg(slug: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return org ?? null;
}

/** Current staff grouped by unit, head coach first. Fictional demo people (isDemo) are never listed on a program. */
export async function getStaff(orgId: string): Promise<{ unit: StaffUnit; people: PersonSummary[] }[]> {
  const rows = await db
    .select({ ...personSummaryCols, unit: people.unit })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(people.currentOrgId, orgId), eq(people.isDemo, false)))
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

/**
 * People who coached at this organization in the past and where they are now: each person's most recent
 * past stint here (latest known season, i.e. end year else start year; undated stints only when nothing
 * dated exists), most recent first, then by name. The limit applies after that ordering.
 */
export async function getAlumni(orgId: string, limit = 60) {
  const recency = sql<number | null>`coalesce(${tenures.endYear}, ${tenures.startYear})`;
  const latest = db
    .selectDistinctOn([tenures.personId], {
      personId: tenures.personId,
      role: tenures.role,
      startYear: tenures.startYear,
      endYear: tenures.endYear,
      recency: recency.as("recency"),
    })
    .from(tenures)
    .where(and(eq(tenures.orgId, orgId), eq(tenures.isCurrent, false), eq(tenures.asPlayer, false)))
    .orderBy(tenures.personId, sql`${recency} desc nulls last`, asc(tenures.sortOrder), asc(tenures.id))
    .as("latest");
  const rows = await db
    .select({ ...personSummaryCols, role: latest.role, startYear: latest.startYear, endYear: latest.endYear })
    .from(latest)
    .innerJoin(people, eq(people.id, latest.personId))
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(and(eq(people.isDemo, false), or(ne(people.currentOrgId, orgId), sql`${people.currentOrgId} is null`)))
    .orderBy(sql`${latest.recency} desc nulls last`, asc(people.fullName))
    .limit(limit);
  return rows.map((r) => ({ person: toSummary(r), role: r.role, startYear: r.startYear, endYear: r.endYear }));
}

export async function getOrgJobs(orgId: string) {
  return db.select().from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.status, "open"), await visibleJobs())).orderBy(desc(jobs.postedAt));
}

/** Escapes LIKE wildcards in user input (backslash is Postgres' default LIKE escape). */
export function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, "\\$&");
}

/**
 * Registry programs matching a name, short name, nickname or exact conference abbreviation,
 * ranked before the limit so the obvious match is never pushed out: exact short name, name or
 * conference first ("mit" → MIT, "nwc" → NWC programs), then name or short-name prefix
 * ("pacific" → Pacific (OR) before Azusa Pacific), then word start, then any substring.
 */
export async function searchOrgs(q: string, limit = 8) {
  const term = q.trim();
  const lower = term.toLowerCase();
  const e = escapeLike(term);
  const like = `%${e}%`;
  const prefix = `${e}%`;
  const wordStart = `% ${e}%`;
  const rank = sql`case
    when lower(${organizations.shortName}) = ${lower} or lower(${organizations.name}) = ${lower} or lower(${conferenceKey}) = ${lower} then 0
    when ${organizations.name} ilike ${prefix} or ${organizations.shortName} ilike ${prefix} then 1
    when ${organizations.name} ilike ${wordStart} or ${organizations.shortName} ilike ${wordStart} or ${organizations.shortName} ilike ${`%(${e}%`} then 2
    else 3 end`;
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
    .where(
      and(
        eq(organizations.inRegistry, true),
        or(ilike(organizations.name, like), ilike(organizations.shortName, like), ilike(organizations.nickname, like), sql`lower(${conferenceKey}) = ${lower}`),
      ),
    )
    .orderBy(rank, asc(organizations.shortName))
    .limit(limit);
}

/** Registry conference abbreviations, cleaned of footnote markers and de-duplicated ("NACC[g]" folds into "NACC"). */
export async function listConferences() {
  const rows = await db
    .selectDistinct({ abbr: conferenceKey })
    .from(organizations)
    .where(and(eq(organizations.inRegistry, true), sql`${conferenceKey} is not null`))
    .orderBy(conferenceKey);
  return rows.map((r) => r.abbr!);
}
