import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { availability, organizations } from "@/db/schema";
import { buildLedger, buildTree, coachingSeasons, currentHeadline, firstSeason, inferredReason, spanText, undatedRoleCount, type RangeText } from "@/components/profile/model";
import type { AvailabilityAudience, RoleGroup } from "@/lib/format";
import type { OrgSummary } from "./people";
import { getProfileCached, getTreeCached } from "./profile";

/*
 * Claim flow (/claim/[slug]) and Open to opportunities settings (/settings/availability).
 * Reads only: the claim flow never changes a person's record (see lib/actions/claim.ts).
 */

export type ClaimOrg = Pick<OrgSummary, "id" | "slug" | "name" | "shortName" | "level" | "conference" | "conferenceAbbr" | "state" | "inRegistry">;

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
  /** The profile ledger's words for this stint's years (spanText), so both screens read the same. */
  range: RangeText;
  /** A year is shown but the source didn't state it (the profile's rule: dotted underline). */
  inferred: boolean;
  /** The profile's plain-words reason, quoting the source ("from the staff bio, which says …"). */
  inferredReason: string;
};

export type ClaimSubject = {
  person: {
    id: string;
    slug: string;
    fullName: string;
    firstName: string | null;
    currentTitle: string | null;
    /**
     * The profile header's headline (currentHeadline): the current stint's role in the bio's words,
     * else the directory title. Every place on the claim page that names the job uses it.
     */
    headline: string | null;
    claimed: boolean;
    isDemo: boolean;
    sourceUrl: string | null;
  };
  currentOrg: ClaimOrg | null;
  /** Coaching stints first (newest first, as the profile orders them), then playing stints. */
  stints: ClaimStint[];
  /** The profile header's numbers, from the profile's own model functions on the same rows. */
  stats: {
    seasonsCoached: number | null;
    /** Some coaching roles have no start year, so the season count is a floor ("34+"), as on the profile. */
    seasonsPlus: boolean;
    stops: number;
    treeSize: number;
    firstSeason: { year: number; inferred: boolean; reason: string } | null;
  };
};

const pickOrg = (o: OrgSummary): ClaimOrg => ({
  id: o.id,
  slug: o.slug,
  name: o.name,
  shortName: o.shortName,
  level: o.level,
  conference: o.conference,
  conferenceAbbr: o.conferenceAbbr,
  state: o.state,
  inRegistry: o.inRegistry,
});

/**
 * The profile a visitor is claiming, with every stint to review. Null when the slug is unknown.
 * Built from the same request-cached reads as /in/[slug] (getProfile, getTree) and the profile's own
 * model functions, so the step 3 preview shows exactly the numbers and words the profile header shows.
 */
export async function getClaimSubject(slug: string): Promise<ClaimSubject | null> {
  const profile = await getProfileCached(slug);
  if (!profile) return null;
  const { person, currentOrg, experience, playing } = profile;
  const tree = await getTreeCached(person.id);

  // The profile page's rows: coaching stints in source order (newest first), then playing stints.
  const rows = [...experience.flatMap((g) => g.roles), ...playing];
  const firstName = person.firstName || person.fullName.split(" ")[0];
  const stints: ClaimStint[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    roleGroup: r.roleGroup as RoleGroup,
    startYear: r.startYear,
    endYear: r.endYear,
    isCurrent: r.isCurrent,
    asPlayer: r.asPlayer,
    yearsExplicit: r.yearsExplicit,
    evidence: r.evidence,
    sourceUrl: r.sourceUrl,
    org: pickOrg(r.org),
    range: spanText(r),
    inferred: !r.yearsExplicit && (!!r.startYear || !!r.endYear),
    inferredReason: inferredReason(r.evidence),
  }));

  return {
    person: {
      id: person.id,
      slug: person.slug,
      fullName: person.fullName,
      firstName: person.firstName,
      currentTitle: person.currentTitle,
      headline: currentHeadline(rows, currentOrg?.id ?? null, person.currentTitle),
      claimed: person.claimed,
      isDemo: person.isDemo,
      sourceUrl: person.sourceUrl,
    },
    currentOrg: currentOrg ? pickOrg(currentOrg) : null,
    stints,
    stats: {
      seasonsCoached: coachingSeasons(rows).length || null,
      seasonsPlus: undatedRoleCount(rows) > 0,
      stops: buildLedger(rows).length,
      treeSize: buildTree(tree, firstName, currentOrg?.slug ?? null).unique,
      firstSeason: firstSeason(rows),
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
