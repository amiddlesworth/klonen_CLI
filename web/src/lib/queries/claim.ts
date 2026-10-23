import "server-only";
import { asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { availability, organizations, people, tenures, treeEdges } from "@/db/schema";
import { seasonCount, type AvailabilityAudience, type RoleGroup } from "@/lib/format";

/*
 * Claim flow (/claim/[slug]) and Open to opportunities settings (/settings/availability).
 * Reads only: the claim flow never changes a person's record (see lib/actions/claim.ts).
 */

export type ClaimOrg = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  level: string | null;
  conference: string | null;
  conferenceAbbr: string | null;
  city: string | null;
  state: string | null;
  inRegistry: boolean;
};

/** One stint as the claim review lists it (serializable: passed to the client flow). */
export type ClaimStint = {
  id: number;
  role: string;
  roleGroup: RoleGroup;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  asPlayer: boolean;
  yearsExplicit: boolean;
  evidence: string | null;
  sourceUrl: string | null;
  org: ClaimOrg;
};

export type ClaimSubject = {
  person: {
    id: string;
    slug: string;
    fullName: string;
    firstName: string | null;
    currentTitle: string | null;
    claimed: boolean;
    isDemo: boolean;
    sourceUrl: string | null;
  };
  currentOrg: ClaimOrg | null;
  /** Coaching stints first (newest first, as the profile orders them), then playing stints. */
  stints: ClaimStint[];
  /** The profile header's numbers, computed the way the profile computes them. */
  stats: { seasonsCoached: number | null; stops: number; treeSize: number; firstSeason: number | null };
};

const orgCols = {
  id: organizations.id,
  slug: organizations.slug,
  name: organizations.name,
  shortName: organizations.shortName,
  level: organizations.level,
  conference: organizations.conference,
  conferenceAbbr: organizations.conferenceAbbr,
  city: organizations.city,
  state: organizations.state,
  inRegistry: organizations.inRegistry,
};

/** The profile a visitor is claiming, with every stint to review. Null when the slug is unknown. */
export async function getClaimSubject(slug: string): Promise<ClaimSubject | null> {
  const [person] = await db
    .select({
      id: people.id,
      slug: people.slug,
      fullName: people.fullName,
      firstName: people.firstName,
      currentTitle: people.currentTitle,
      currentOrgId: people.currentOrgId,
      claimed: people.claimed,
      isDemo: people.isDemo,
      sourceUrl: people.sourceUrl,
    })
    .from(people)
    .where(eq(people.slug, slug))
    .limit(1);
  if (!person) return null;

  const [rows, currentOrg, [tree]] = await Promise.all([
    db
      .select({
        id: tenures.id,
        role: tenures.role,
        roleGroup: tenures.roleGroup,
        startYear: tenures.startYear,
        endYear: tenures.endYear,
        isCurrent: tenures.isCurrent,
        asPlayer: tenures.asPlayer,
        yearsExplicit: tenures.yearsExplicit,
        evidence: tenures.evidence,
        sourceUrl: tenures.sourceUrl,
        org: orgCols,
      })
      .from(tenures)
      .innerJoin(organizations, eq(organizations.id, tenures.orgId))
      .where(eq(tenures.personId, person.id))
      .orderBy(asc(tenures.sortOrder), asc(tenures.id)),
    person.currentOrgId
      ? db
          .select(orgCols)
          .from(organizations)
          .where(eq(organizations.id, person.currentOrgId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select({ n: sql<number>`count(distinct case when ${treeEdges.mentorId} = ${person.id} then ${treeEdges.menteeId} else ${treeEdges.mentorId} end)::int` })
      .from(treeEdges)
      .where(or(eq(treeEdges.mentorId, person.id), eq(treeEdges.menteeId, person.id))),
  ]);

  const stints = rows as ClaimStint[];
  const coaching = stints.filter((s) => !s.asPlayer);
  const starts = coaching.map((s) => s.startYear).filter((y): y is number => !!y);
  const firstSeason = starts.length ? Math.min(...starts) : null;
  return {
    person: {
      id: person.id,
      slug: person.slug,
      fullName: person.fullName,
      firstName: person.firstName,
      currentTitle: person.currentTitle,
      claimed: person.claimed,
      isDemo: person.isDemo,
      sourceUrl: person.sourceUrl,
    },
    currentOrg,
    stints: [...coaching, ...stints.filter((s) => s.asPlayer)],
    stats: {
      seasonsCoached: firstSeason ? seasonCount(firstSeason, null, true) : null,
      stops: new Set(coaching.map((s) => s.org.id)).size,
      treeSize: tree?.n ?? 0,
      firstSeason,
    },
  };
}

/* ---------- Open to opportunities ---------- */

export type AvailabilitySettings = {
  open: boolean;
  audience: AvailabilityAudience;
  selectedOrgIds: string[];
  roles: string[];
  regions: string[];
  updatedAt: string | null;
};

const DEFAULT_SETTINGS: AvailabilitySettings = {
  open: false,
  audience: "all_except_current",
  selectedOrgIds: [],
  roles: [],
  regions: [],
  updatedAt: null,
};

/** The coach's private setting; defaults (off, all employers except the current program) when never saved. */
export async function getAvailabilitySettings(personId: string): Promise<AvailabilitySettings> {
  const [row] = await db.select().from(availability).where(eq(availability.personId, personId)).limit(1);
  if (!row) return DEFAULT_SETTINGS;
  return {
    open: row.open,
    audience: row.audience,
    selectedOrgIds: row.selectedOrgIds ?? [],
    roles: row.roles ?? [],
    regions: row.regions ?? [],
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A registry program offered by the "Specific programs" picker. */
export type PickerProgram = {
  id: string;
  name: string;
  shortName: string;
  conferenceAbbr: string | null;
  conference: string | null;
  level: string | null;
  state: string | null;
};

/** Every program in the registry (the 244 Division III programs), alphabetical. */
export async function getRegistryPrograms(): Promise<PickerProgram[]> {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      shortName: organizations.shortName,
      conferenceAbbr: organizations.conferenceAbbr,
      conference: organizations.conference,
      level: organizations.level,
      state: organizations.state,
    })
    .from(organizations)
    .where(eq(organizations.inRegistry, true))
    .orderBy(asc(organizations.name));
}

/** Ids of registry programs, for validating a saved selection. */
export async function getRegistryProgramIds(): Promise<Set<string>> {
  const rows = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.inRegistry, true));
  return new Set(rows.map((r) => r.id));
}
