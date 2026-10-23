import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations, people, tenures, treeEdges } from "@/db/schema";
import { CURRENT_SEASON } from "@/lib/brand";
import { conferenceKey } from "./orgs";
import { personSummaryCols, toSummary, type PersonSummary } from "./people";

export type Move = {
  kind: "joined" | "promoted";
  person: PersonSummary;
  role: string;
  org: { slug: string; shortName: string; nickname: string | null; conferenceAbbr: string | null };
  previous: { role: string; orgShortName: string } | null;
  season: number;
};

export type JobCardData = {
  id: number;
  title: string;
  roleGroup: string;
  employmentType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: Date;
  source: "sample" | "native" | "aggregated";
  org: { slug: string; shortName: string; nickname: string | null; conferenceAbbr: string | null; state: string | null; level: string | null };
};

/** Hires and promotions for the current season, derived from stints that start this season. */
export async function getMoves(limit = 30, offset = 0): Promise<Move[]> {
  const rows = await db
    .select({
      ...personSummaryCols,
      role: tenures.role,
      tOrgId: organizations.id,
      tOrgSlug: organizations.slug,
      tOrgShort: organizations.shortName,
      tOrgNick: organizations.nickname,
      tOrgConf: organizations.conferenceAbbr,
      startYear: tenures.startYear,
    })
    .from(tenures)
    .innerJoin(people, eq(people.id, tenures.personId))
    .innerJoin(organizations, eq(organizations.id, tenures.orgId))
    .where(and(eq(tenures.isCurrent, true), eq(tenures.asPlayer, false), eq(tenures.startYear, CURRENT_SEASON), eq(people.isDemo, false)))
    .orderBy(sql`case ${people.roleGroup} when 'head_coach' then 0 when 'coordinator' then 1 else 2 end`, people.fullName)
    .limit(limit)
    .offset(offset);
  if (!rows.length) return [];
  // Previous stint for each person, to tell a promotion from a hire: the past stint with the latest known
  // season (its end year, else its start year), so a recent stint known only by its end year ("?–2025")
  // beats an old fully dated one. Undated stints come last; ties fall back to the source order.
  const prev = await db.execute<{ person_id: string; role: string; org_id: string; short_name: string }>(sql`
    SELECT DISTINCT ON (t.person_id) t.person_id, t.role, t.org_id, o.short_name
    FROM tenures t JOIN organizations o ON o.id = t.org_id
    WHERE t.is_current = false AND t.as_player = false AND t.person_id IN (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})
    ORDER BY t.person_id, coalesce(t.end_year, t.start_year) DESC NULLS LAST, t.sort_order, t.id`);
  const prevBy = new Map(prev.rows.map((p) => [p.person_id, p]));
  return rows.map((r) => {
    const p = prevBy.get(r.id);
    const summary = toSummary(r);
    const promoted = !!p && p.org_id === r.tOrgId;
    return {
      kind: promoted ? "promoted" : "joined",
      person: summary,
      role: r.role,
      org: { slug: r.tOrgSlug, shortName: r.tOrgShort, nickname: r.tOrgNick, conferenceAbbr: r.tOrgConf },
      previous: p ? { role: p.role, orgShortName: p.short_name } : null,
      season: r.startYear ?? CURRENT_SEASON,
    };
  });
}

const jobCols = {
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
};

export type JobRow = {
  id: number;
  title: string;
  roleGroup: string;
  employmentType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: Date;
  source: "sample" | "native" | "aggregated";
  orgSlug: string;
  orgShortName: string;
  orgNickname: string | null;
  orgConferenceAbbr: string | null;
  orgState: string | null;
  orgLevel: string | null;
};

export function toJobCard(x: JobRow): JobCardData {
  return {
    id: x.id,
    title: x.title,
    roleGroup: x.roleGroup,
    employmentType: x.employmentType,
    salaryMin: x.salaryMin,
    salaryMax: x.salaryMax,
    postedAt: x.postedAt,
    source: x.source,
    org: { slug: x.orgSlug, shortName: x.orgShortName, nickname: x.orgNickname, conferenceAbbr: x.orgConferenceAbbr, state: x.orgState, level: x.orgLevel },
  };
}

export async function getRecentJobs(limit = 5): Promise<JobCardData[]> {
  const rows = await db.select(jobCols).from(jobs).innerJoin(organizations, eq(organizations.id, jobs.orgId)).where(eq(jobs.status, "open")).orderBy(desc(jobs.postedAt)).limit(limit);
  return rows.map(toJobCard);
}

export type FeedItem = { type: "move"; move: Move } | { type: "job"; job: JobCardData };

/** Home feed: three moves, then a job, repeating. */
export async function getFeed(limit = 24): Promise<FeedItem[]> {
  const [moves, recent] = await Promise.all([getMoves(limit), getRecentJobs(Math.ceil(limit / 4))]);
  const items: FeedItem[] = [];
  let j = 0;
  moves.forEach((m, i) => {
    items.push({ type: "move", move: m });
    if (i % 3 === 2 && recent[j]) items.push({ type: "job", job: recent[j++] });
  });
  while (recent[j]) items.push({ type: "job", job: recent[j++] });
  return items;
}

/** Numbers for the right-rail carousel tracker. Conferences are grouped on the cleaned abbreviation ("NACC[g]" counts as NACC). */
export async function getCarouselStats() {
  const newHire = and(eq(tenures.isCurrent, true), eq(tenures.startYear, CURRENT_SEASON), eq(tenures.asPlayer, false), eq(people.isDemo, false));
  const [[{ openJobs }], [{ hires }], byConf] = await Promise.all([
    db.select({ openJobs: count() }).from(jobs).where(eq(jobs.status, "open")),
    db.select({ hires: count() }).from(tenures).innerJoin(people, eq(people.id, tenures.personId)).where(newHire),
    db
      .select({ conference: conferenceKey, n: count() })
      .from(tenures)
      .innerJoin(people, eq(people.id, tenures.personId))
      .innerJoin(organizations, eq(organizations.id, tenures.orgId))
      .where(newHire)
      .groupBy(conferenceKey)
      .orderBy(desc(count()), conferenceKey)
      .limit(6),
  ]);
  return { openJobs, hires, byConference: (byConf.filter((r) => r.conference) as { conference: string; n: number }[]).slice(0, 5) };
}

/** Dataset-wide numbers for the landing page. */
export async function getDatasetStats() {
  const r = await db.execute<{ programs: number; coaches: number; stints: number; edges: number }>(sql`SELECT
    (SELECT count(DISTINCT current_org_id) FROM people WHERE is_demo = false)::int AS programs,
    (SELECT count(*) FROM people WHERE is_demo = false)::int AS coaches,
    (SELECT count(*) FROM tenures t JOIN people p ON p.id = t.person_id WHERE p.is_demo = false AND t.as_player = false)::int AS stints,
    (SELECT count(*) FROM ${treeEdges})::int AS edges`);
  return r.rows[0];
}
