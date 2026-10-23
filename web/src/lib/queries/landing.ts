import "server-only";
import { cache } from "react";
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, tenures, treeEdges } from "@/db/schema";
import { seasonsCovered } from "@/lib/format";
import { getDatasetStats } from "./feed";
import { conferenceKey } from "./orgs";

/* Queries for the signed-out landing page (DESIGN.md §8.10). */

export type LandingStats = {
  /** Registry programs with at least one coach on staff. */
  programs: number;
  /** All NCAA Division III football programs in the registry. */
  registryPrograms: number;
  /** Real (non-demo) coaches. */
  coaches: number;
  /** Coaching stints (playing stints excluded) of real coaches. */
  stints: number;
  /** Derived coaching-tree edges (worked under + worked alongside). */
  edges: number;
};

/** Dataset-wide proof points: getDatasetStats plus the size of the program registry. */
export async function getLandingStats(): Promise<LandingStats> {
  const [base, [registry]] = await Promise.all([
    getDatasetStats(),
    db.select({ n: count() }).from(organizations).where(eq(organizations.inRegistry, true)),
  ]);
  return {
    programs: base?.programs ?? 0,
    registryPrograms: registry?.n ?? 0,
    coaches: base?.coaches ?? 0,
    stints: base?.stints ?? 0,
    edges: base?.edges ?? 0,
  };
}

/** Shared by generateMetadata and the page within one request. */
export const getLandingStatsCached = cache(getLandingStats);

export type SampleProfile = {
  id: string;
  slug: string;
  fullName: string;
  currentTitle: string | null;
  claimed: boolean;
  org: { slug: string; shortName: string; level: string | null; conference: string | null; conferenceAbbr: string | null };
  /** Distinct seasons the coaching stints cover (same rule as the profile header stat). */
  seasons: number | null;
  /** Distinct organizations coached at (the profile's "Coaching stops"). */
  stops: number;
  /** Unique people in the coaching tree (the profile's "In coaching tree"). */
  treeSize: number;
  /** Earlier organizations, most recent first (short names), excluding the current program. */
  previous: string[];
};

/** One slot per conference ("SAA[m]" and "SAA" are the same conference); programs without one count alone. */
const conferenceSlot = sql<string>`coalesce(${conferenceKey}, ${organizations.id})`;

/**
 * Sample profiles: real, current Division III head coaches with the richest sourced careers (most
 * coaching stops, then the largest tree), at most one per conference so the row shows the breadth
 * of the dataset. Only careers whose stints are mostly dated (≥ 80 %), so the season count means
 * something. Deterministic: ties break on the slug.
 */
export async function getSampleProfiles(limit = 4): Promise<SampleProfile[]> {
  const stops = sql<number>`count(distinct ${tenures.orgId})::int`;
  const dated = sql<number>`count(*) filter (where ${tenures.startYear} is not null)::int`;
  const tree = sql<number>`(select count(distinct case when e.mentor_id = ${people.id} then e.mentee_id else e.mentor_id end)
    from ${treeEdges} e where e.mentor_id = ${people.id} or e.mentee_id = ${people.id})::int`;
  const candidates = await db
    .select({ id: people.id, conference: conferenceSlot, stops, tree })
    .from(people)
    .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
    .innerJoin(tenures, sql`${tenures.personId} = ${people.id} and ${tenures.asPlayer} = false`)
    .where(sql`${people.isDemo} = false and ${people.roleGroup} = 'head_coach' and ${organizations.inRegistry} = true`)
    .groupBy(people.id, organizations.id)
    .having(sql`count(distinct ${tenures.orgId}) >= 4 and ${dated} >= 0.8 * count(*)`)
    .orderBy(sql`${stops} desc`, sql`${tree} desc`, asc(people.slug))
    .limit(40);

  const picked: typeof candidates = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.conference)) continue;
    seen.add(c.conference);
    picked.push(c);
    if (picked.length === limit) break;
  }
  if (!picked.length) return [];
  const ids = picked.map((c) => c.id);

  const [rows, stints] = await Promise.all([
    db
      .select({
        id: people.id,
        slug: people.slug,
        fullName: people.fullName,
        currentTitle: people.currentTitle,
        claimed: people.claimed,
        currentOrgId: people.currentOrgId,
        orgSlug: organizations.slug,
        orgShortName: organizations.shortName,
        orgLevel: organizations.level,
        orgConference: organizations.conference,
        orgConferenceAbbr: organizations.conferenceAbbr,
      })
      .from(people)
      .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(inArray(people.id, ids)),
    db
      .select({
        personId: tenures.personId,
        orgId: tenures.orgId,
        orgShortName: organizations.shortName,
        startYear: tenures.startYear,
        endYear: tenures.endYear,
        isCurrent: tenures.isCurrent,
      })
      .from(tenures)
      .innerJoin(organizations, eq(organizations.id, tenures.orgId))
      .where(sql`${inArray(tenures.personId, ids)} and ${tenures.asPlayer} = false`)
      // The profile orders stints by sortOrder (newest first).
      .orderBy(asc(tenures.personId), asc(tenures.sortOrder)),
  ]);

  const byId = new Map(rows.map((r) => [r.id, r]));
  return picked.flatMap((c) => {
    const r = byId.get(c.id);
    if (!r) return [];
    const mine = stints.filter((s) => s.personId === c.id);
    const previous: string[] = [];
    for (const s of mine) {
      if (s.orgId === r.currentOrgId || previous.includes(s.orgShortName)) continue;
      previous.push(s.orgShortName);
    }
    return [
      {
        id: r.id,
        slug: r.slug,
        fullName: r.fullName,
        currentTitle: r.currentTitle,
        claimed: r.claimed,
        org: { slug: r.orgSlug, shortName: r.orgShortName, level: r.orgLevel, conference: r.orgConference, conferenceAbbr: r.orgConferenceAbbr },
        seasons: seasonsCovered(mine),
        stops: new Set(mine.map((s) => s.orgId)).size,
        treeSize: c.tree,
        previous,
      },
    ];
  });
}

export type TreeSearchExample = { slug: string; fullName: string; firstName: string; orgShortName: string };

/**
 * A real coaching-tree search to show employers: the current head coach with the most people who
 * worked under them (ties break on the slug). Null when the tree is empty.
 */
export async function getTreeSearchExample(): Promise<TreeSearchExample | null> {
  const mentees = sql<number>`count(distinct ${treeEdges.menteeId})`;
  const [row] = await db
    .select({ slug: people.slug, fullName: people.fullName, firstName: people.firstName, orgShortName: organizations.shortName })
    .from(treeEdges)
    .innerJoin(people, eq(people.id, treeEdges.mentorId))
    .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(sql`${treeEdges.kind} = 'worked_under' and ${people.isDemo} = false and ${people.roleGroup} = 'head_coach'`)
    .groupBy(people.id, organizations.id)
    .orderBy(sql`${mentees} desc`, asc(people.slug))
    .limit(1);
  if (!row) return null;
  return { slug: row.slug, fullName: row.fullName, firstName: row.firstName || row.fullName.split(/\s+/)[0], orgShortName: row.orgShortName };
}
