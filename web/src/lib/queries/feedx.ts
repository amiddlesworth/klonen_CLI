import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, count, eq, gte, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations, people, profileViews, tenures, treeEdges } from "@/db/schema";
import { isMilestoneSeason, otherStops, staffRun, stopBefore, type MilestoneStint, type StaffRun } from "@/components/feed/milestones";
import { classifyMove, lastSeason, pastStints, recordStints, shownEnd, undatedStints, type MoveKind, type StintFacts } from "@/components/feed/moves";
import { cleanTitle, inferredReason, pickQuote, positionKeys, schoolKey, schoolShort, stableHash, unnamedOrg } from "@/components/feed/text";
import { CURRENT_SEASON } from "@/lib/brand";
import { conferenceShort } from "@/lib/format";
import type { Session } from "@/lib/session";
import { getMoves, getRecentJobs } from "./feed";
import { getPeopleSummaries, getRelated } from "./people";
import { getFollowedOrgIds } from "./program";

/*
 * Home feed queries (DESIGN.md §8.5). Moves come from getMoves() (lib/queries/feed.ts) and are
 * enriched here with each coach's recent stints, the staff-bio source and a personal reason derived
 * from the session (program, head coach, coaching tree, alma mater, conference). Nothing personal is
 * hard-coded: every reason is computed from the signed-in viewer.
 */

/** The feed's scope: Division III programs (the "Showing Division III" scope). */
export const FEED_LEVEL = "NCAA D-III";
/** Full feed items per page; the long tail goes to the digest. */
export const FULL_PER_PAGE = 6;
/** Digest rows per page ("More staff moves"). */
export const DIGEST_PER_PAGE = 12;
/** Job cards per page on the Jobs filter. */
export const JOBS_PER_PAGE = 10;
/** Milestone cards per page on the Milestones filter. */
export const MILESTONES_PER_PAGE = 10;

export type FeedFilter = "all" | "moves" | "jobs" | "milestones";

export function parseFilter(v: string | string[] | undefined): FeedFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "moves" || s === "jobs" || s === "milestones" ? s : "all";
}

/** The Moves filter narrowed to one tracker KPI (§8.3: each KPI links to its filtered list). */
export type MoveFilterKind = "hires" | "promotions" | "other";

export function parseMoveKind(v: string | string[] | undefined): MoveFilterKind | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "hires" || s === "promotions" || s === "other" ? s : null;
}

function matchesKind(m: FeedMove, kind: MoveFilterKind | null): boolean {
  if (!kind) return true;
  if (kind === "hires") return m.kind === "joined" || m.kind === "returned";
  if (kind === "promotions") return m.kind === "promoted";
  return m.kind === "moved";
}

export function parsePage(v: string | string[] | undefined): number {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number.parseInt(s ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

/* ---------- Types ---------- */

export type FeedOrg = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  conference: string | null;
  /** Cleaned abbreviation ("NACC[g]" -> "NACC"). */
  conferenceAbbr: string | null;
  level: string | null;
  city: string | null;
  state: string | null;
  inRegistry: boolean;
};

export type RecordRow = {
  key: number;
  /** Sentence-case title as published, "(player)" for playing stints; formatted by the component. */
  role: string;
  asPlayer: boolean;
  /** Program short name, or null when the row drops it (moves within one program). */
  org: string | null;
  /** For a placeholder organization (the bio doesn't name it): "High school", shown muted with "(not named in the bio)". Omitted otherwise. */
  orgUnnamed?: string;
  orgId: string;
  startYear: number | null;
  endYear: number | null;
  inferred: boolean;
  /** Plain-words reason for the dotted year (§6.2), when inferred. */
  inferredReason: string | null;
  /** The new role (last row). */
  now: boolean;
};

export type PriorStint = {
  role: string;
  orgId: string;
  orgShortName: string;
  /** "pro/semi-pro", "high school", …: how prose names the organization ("played for the Atlanta Falcons"). */
  orgLevel: string | null;
  startYear: number | null;
  /** Never the hire season or later (a stint the source runs into 2026 shows as ending in 2025). */
  endYear: number | null;
  inferred: boolean;
  inferredReason: string | null;
  asPlayer: boolean;
};

export type { MoveKind };

export type FeedMove = {
  key: string;
  /** How the move reads: "joined", "returned" (a hire), "promoted", or "moved" (another role at the same program). */
  kind: MoveKind;
  person: { id: string; slug: string; fullName: string; firstName: string | null; almaMater: string | null; claimed: boolean };
  /** Current title as published (cleaned of table leftovers). */
  role: string;
  roleGroup: string;
  org: FeedOrg;
  sourceUrl: string | null;
  /** A verbatim, pronoun-free line from the new staff bio that adds a fact, or null. */
  quote: string | null;
  /** The last 2–3 stints, oldest first, ending on the new role. Empty when there is no prior stint. */
  record: RecordRow[];
  /**
   * The stint the digest sentence and "Previously …" lines name: the latest coaching stint (else
   * playing stint) for a hire; the latest earlier role at the program for a return, promotion or move.
   */
  previous: PriorStint | null;
  /**
   * Earlier stints with no years in the source, kept out of the dated record (§8.3) and named in one
   * facts line instead: an undated earlier role at this program (a return or a role change), and,
   * when the record has fewer than two dated stints, undated stops elsewhere. Bio order.
   */
  undated: PriorStint[];
  /**
   * Past programs: org id → whether the coach only played there, and (for Division III programs, the
   * only ones a feed viewer works at) the latest stint there, for the "coached at your program" facts
   * line. Kept small: this list is cached for every move of the season.
   */
  priorOrgs: Record<string, { stint?: PriorStint; playedOnly: boolean }>;
  /** Any year shown in the record is inferred (yearsExplicit = false). */
  recordInferred: boolean;
  /** The year in the digest sentence (previous stint) is inferred. */
  previousInferred: boolean;
};

export type ReasonKind = "program" | "headCoach" | "colleague" | "formerStaff" | "alum" | "conference";
export type FeedReason = { kind: ReasonKind; subject: string; text: string };

export type FeedJob = {
  id: number;
  title: string;
  roleGroup: string;
  employmentType: string;
  isSample: boolean;
  org: FeedOrg;
  matchesPosition: boolean;
  atViewerProgram: boolean;
  inViewerConference: boolean;
  /** Colleagues of the viewer who played or coached at this program (up to 3 shown). */
  network: { people: { slug: string; fullName: string }[]; total: number; verb: "played" | "coached" | "played or coached" } | null;
};

/**
 * A milestone (§8.5): this season is a coach's 10th, 15th, 20th or 25th-and-later on one staff,
 * counted from stints whose years the source states.
 */
export type FeedMilestone = {
  key: string;
  person: { id: string; slug: string; fullName: string; firstName: string | null; almaMater: string | null; claimed: boolean };
  org: FeedOrg;
  /** Current title as published. */
  role: string;
  roleGroup: string;
  /** This season's place in the unbroken run on the staff (42 for a coach there since 1985). */
  seasons: number;
  firstSeason: number;
  /** The title the run started with, when it differs from the current one. */
  firstRole: string | null;
  /** Distinct roles held on the staff in the run. */
  roles: number;
  /** Distinct other programs in the coaching record. */
  otherStops: number;
  /** The coaching stint elsewhere just before the run, for the facts line. */
  before: PriorStint | null;
  sourceUrl: string | null;
};

export type FeedEntry =
  | { type: "move"; key: string; move: FeedMove; reason: FeedReason | null }
  | { type: "group"; key: string; org: FeedOrg; moves: FeedMove[]; reason: FeedReason | null; sourceUrl: string | null }
  | { type: "milestone"; key: string; milestone: FeedMilestone; reason: FeedReason | null }
  | { type: "job"; key: string; job: FeedJob };

export type FeedViewer = {
  role: "coach" | "employer";
  /** A made-up demo account with no real person behind it (the athletic director): shown with a Demo chip. */
  fictional: boolean;
  personId: string | null;
  slug: string | null;
  name: string;
  /** Avatar tint key, the same as the shell's (the person's slug, or the user id). */
  tintKey: string;
  title: string | null;
  almaMater: string | null;
  org: FeedOrg | null;
  headCoach: { id: string; slug: string; fullName: string } | null;
  /** First-degree tree colleagues (worked under / alongside the viewer). */
  colleagues: { id: string; slug: string; fullName: string; edgeOrgShortName: string; edgeOrgId: string }[];
};

/* ---------- Viewer ---------- */

const orgCols = {
  id: organizations.id,
  slug: organizations.slug,
  name: organizations.name,
  shortName: organizations.shortName,
  conference: organizations.conference,
  conferenceAbbr: organizations.conferenceAbbr,
  level: organizations.level,
  city: organizations.city,
  state: organizations.state,
  inRegistry: organizations.inRegistry,
};

type OrgRow = { id: string; slug: string; name: string; shortName: string; conference: string | null; conferenceAbbr: string | null; level: string | null; city: string | null; state: string | null; inRegistry: boolean };

function toOrg(o: typeof organizations.$inferSelect | OrgRow): FeedOrg {
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    shortName: o.shortName,
    conference: o.conference,
    conferenceAbbr: conferenceShort(o.conferenceAbbr),
    level: o.level,
    city: o.city,
    state: o.state,
    inRegistry: o.inRegistry,
  };
}

/** Everything the feed needs to know about the signed-in viewer, derived from the session. Cached per request (per session object). */
export const getFeedViewer = cache(async (session: NonNullable<Session>): Promise<FeedViewer> => {
  const { user, person, org } = session;
  const [headCoach, colleagues] = await Promise.all([
    org
      ? db
          .select({ id: people.id, slug: people.slug, fullName: people.fullName })
          .from(people)
          .where(and(eq(people.currentOrgId, org.id), eq(people.roleGroup, "head_coach"), eq(people.isDemo, false)))
          .orderBy(people.fullName)
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    person ? getColleagues(person.id) : Promise.resolve([]),
  ]);
  return {
    role: user.kind === "employer" ? "employer" : "coach",
    fictional: user.isDemo && !person,
    personId: person?.id ?? null,
    slug: person?.slug ?? null,
    name: user.name,
    tintKey: person?.slug ?? user.id,
    title: user.kind === "employer" ? "Athletic director" : cleanTitle(person?.currentTitle) || null,
    almaMater: person?.almaMater ?? null,
    org: org ? toOrg(org) : null,
    headCoach: headCoach && headCoach.id !== person?.id ? headCoach : null,
    colleagues,
  };
});

async function getColleagues(personId: string) {
  const rows = await db
    .select({
      mentorId: treeEdges.mentorId,
      menteeId: treeEdges.menteeId,
      endYear: treeEdges.endYear,
      orgId: organizations.id,
      orgShortName: organizations.shortName,
    })
    .from(treeEdges)
    .innerJoin(organizations, eq(organizations.id, treeEdges.orgId))
    .where(or(eq(treeEdges.mentorId, personId), eq(treeEdges.menteeId, personId)))
    .orderBy(sql`${treeEdges.endYear} desc nulls last`);
  const ids = [...new Set(rows.map((r) => (r.mentorId === personId ? r.menteeId : r.mentorId)))];
  if (!ids.length) return [];
  const names = await db.select({ id: people.id, slug: people.slug, fullName: people.fullName }).from(people).where(inArray(people.id, ids));
  const byId = new Map(names.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: FeedViewer["colleagues"] = [];
  for (const r of rows) {
    const id = r.mentorId === personId ? r.menteeId : r.mentorId;
    const p = byId.get(id);
    if (!p || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...p, edgeOrgShortName: r.orgShortName, edgeOrgId: r.orgId });
  }
  return out;
}

/* ---------- Moves ---------- */

/**
 * All Division III moves this season, with records, sources and quotes. Cached per request.
 *
 * getMoves() supplies the season's new stints; each one is then read against the coach's own past
 * stints (classifyMove): a stint that only restates last season's role at the same program is not a
 * move and is left out, a return after time away is a hire, and "promoted" needs a more senior role
 * than the one held at the program through last season.
 *
 * The result depends only on seeded tenures, not on the viewer, so it is cached across requests
 * (keyed on the season and this derivation's version) and per request on top. A cache entry that
 * can't be read (a truncated write during a dev-server restart) falls back to deriving the list.
 */
export const getAllFeedMoves = cache(async (): Promise<FeedMove[]> => {
  try {
    return await buildFeedMoves();
  } catch (err) {
    console.error("feed: cached moves unreadable, deriving them again", err);
    return deriveFeedMoves();
  }
});

/** Bump when the derivation below changes, so a cached list from older code isn't served. */
const FEED_MOVES_VERSION = "6";

const buildFeedMoves = unstable_cache((): Promise<FeedMove[]> => deriveFeedMoves(), ["feed-moves", String(CURRENT_SEASON), FEED_MOVES_VERSION], {
  revalidate: 600,
  tags: ["feed-moves"],
});

const stintCols = {
  id: tenures.id,
  personId: tenures.personId,
  orgId: tenures.orgId,
  role: tenures.role,
  roleGroup: tenures.roleGroup,
  startYear: tenures.startYear,
  endYear: tenures.endYear,
  isCurrent: tenures.isCurrent,
  asPlayer: tenures.asPlayer,
  yearsExplicit: tenures.yearsExplicit,
  evidence: tenures.evidence,
  sourceUrl: tenures.sourceUrl,
  sport: tenures.sport,
  sortOrder: tenures.sortOrder,
  org: orgCols,
};

const personCols = {
  id: people.id,
  slug: people.slug,
  fullName: people.fullName,
  firstName: people.firstName,
  almaMater: people.almaMater,
  bioExcerpt: people.bioExcerpt,
  sourceUrl: people.sourceUrl,
  claimed: people.claimed,
};

type StintRow = {
  id: number;
  personId: string;
  orgId: string;
  role: string;
  roleGroup: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  asPlayer: boolean;
  yearsExplicit: boolean;
  evidence: string | null;
  sourceUrl: string | null;
  sport: string;
  sortOrder: number;
  org: OrgRow;
};

function groupByPerson<T extends { personId: string }>(rows: T[]): Map<string, T[]> {
  const byPerson = new Map<string, T[]>();
  for (const r of rows) {
    const list = byPerson.get(r.personId);
    if (list) list.push(r);
    else byPerson.set(r.personId, [r]);
  }
  return byPerson;
}

/** Converters from stint rows to the shapes cards read, with the inferred-year reason and the end-year clamp. */
function stintShapes(bioUrl: string | null) {
  const reasonFor = (s: StintRow) => (s.yearsExplicit ? null : inferredReason(s.evidence, s.sourceUrl ?? bioUrl));
  const toPrior = (s: StintRow): PriorStint => ({
    role: cleanTitle(s.role),
    orgId: s.org.id,
    orgShortName: s.org.shortName,
    orgLevel: s.org.level,
    startYear: s.startYear,
    endYear: shownEnd(s.endYear, CURRENT_SEASON),
    inferred: !s.yearsExplicit,
    inferredReason: reasonFor(s),
    asPlayer: s.asPlayer,
  });
  const toRow = (s: StintRow, dropOrg: boolean, now = false): RecordRow => ({
    key: s.id,
    role: cleanTitle(s.role),
    asPlayer: s.asPlayer,
    org: dropOrg ? null : s.org.shortName,
    ...(!dropOrg && unnamedOrg(s.org.id) ? { orgUnnamed: unnamedOrg(s.org.id)!.label } : {}),
    orgId: s.org.id,
    startYear: s.startYear,
    endYear: now ? s.startYear : shownEnd(s.endYear, CURRENT_SEASON),
    inferred: !s.yearsExplicit,
    inferredReason: reasonFor(s),
    now,
  });
  return { toPrior, toRow };
}

async function deriveFeedMoves(): Promise<FeedMove[]> {
  const moves = await getMoves(5000, 0);
  if (!moves.length) return [];
  const ids = moves.map((m) => m.person.id);
  const [rows, persons] = await Promise.all([
    db
      .select(stintCols)
      .from(tenures)
      .innerJoin(organizations, eq(organizations.id, tenures.orgId))
      .where(inArray(tenures.personId, ids))
      .orderBy(tenures.personId, tenures.sortOrder, tenures.id),
    db.select(personCols).from(people).where(inArray(people.id, ids)),
  ]);
  type Stint = StintRow & StintFacts;
  const byPerson = groupByPerson<Stint>(rows);
  const personById = new Map(persons.map((p) => [p.id, p]));
  const dated = (s: Stint) => lastSeason(s) !== null;

  const seen = new Set<string>();
  const out: FeedMove[] = [];
  for (const m of moves) {
    if (seen.has(m.person.id)) continue;
    const stints = byPerson.get(m.person.id) ?? [];
    const current = stints.find((s) => s.isCurrent && !s.asPlayer && s.sport === "football" && s.startYear === CURRENT_SEASON);
    if (!current || current.org.level !== FEED_LEVEL) continue;
    const info = personById.get(m.person.id);
    const coaching = pastStints(stints, current.id, CURRENT_SEASON, false);
    const playing = pastStints(stints, current.id, CURRENT_SEASON, true);
    const kind = classifyMove(current, coaching, CURRENT_SEASON);
    if (kind === "continued") continue;
    seen.add(m.person.id);

    const bioUrl = info?.sourceUrl ?? null;
    const { toPrior, toRow } = stintShapes(bioUrl);

    // The record holds dated stints only (its year column is its point); undated ones go in one
    // facts line. Rows end on the new role.
    const sameOrg = coaching.filter((s) => s.org.id === current.org.id);
    const elsewhere = coaching.filter((s) => s.org.id !== current.org.id);
    const withinProgram = kind === "promoted" || kind === "moved";
    let picked: Stint[] = [];
    let undated: Stint[] = [];
    let prev: Stint | null = null;
    if (withinProgram) {
      picked = recordStints(sameOrg, 2);
      prev = sameOrg[0] ?? null;
      if (picked.length < 2) undated = undatedStints(sameOrg);
    } else if (kind === "returned") {
      // The earlier stint here backs up "returned"; the latest stint elsewhere shows where from.
      const back = sameOrg.find(dated) ?? sameOrg[0];
      prev = back;
      if (dated(back)) {
        const since = lastSeason(back)!;
        const other = elsewhere.find((s) => (lastSeason(s) ?? -Infinity) > since);
        const extra = other ?? coaching.find((s) => s !== back && dated(s));
        picked = recordStints(extra ? [back, extra] : [back], 2);
      } else {
        // No years for the earlier role here: the record shows where the coach came from, and the
        // facts line names the role here.
        picked = recordStints(elsewhere, 2);
        undated = [back, ...(picked.length < 2 ? undatedStints(elsewhere) : [])];
      }
    } else if (coaching.length) {
      picked = recordStints(coaching, 2);
      prev = coaching[0];
      if (picked.length < 2) undated = undatedStints(coaching);
      // Only undated coaching stops: a dated playing career still gives the record a year.
      if (!picked.length) picked = recordStints(playing, 1);
    } else if (playing.length) {
      picked = recordStints(playing, 2);
      prev = playing[0];
      if (!picked.length) undated = undatedStints(playing).slice(0, 1);
    }
    const record = picked.length ? [...picked.map((s) => toRow(s, withinProgram)), toRow(current, withinProgram, true)] : [];

    const priorOrgs: FeedMove["priorOrgs"] = {};
    for (const s of [...coaching, ...playing]) {
      const had = priorOrgs[s.org.id];
      // A coaching stint outranks playing there; the first coaching stint seen is the latest.
      if (had && (had.playedOnly === false || s.asPlayer)) continue;
      // The stint only where a facts line could need it: a Division III program the record doesn't show.
      const needsStint = s.org.level === FEED_LEVEL && !record.some((r) => r.orgId === s.org.id);
      priorOrgs[s.org.id] = { playedOnly: s.asPlayer, ...(needsStint ? { stint: toPrior(s) } : {}) };
    }

    out.push({
      key: m.person.id,
      kind,
      person: {
        id: m.person.id,
        slug: m.person.slug,
        fullName: m.person.fullName,
        firstName: info?.firstName ?? null,
        almaMater: info?.almaMater ?? null,
        claimed: info?.claimed ?? false,
      },
      role: cleanTitle(current.role),
      roleGroup: current.roleGroup,
      org: toOrg(current.org),
      sourceUrl: current.sourceUrl ?? bioUrl,
      quote: pickQuote(info?.bioExcerpt ?? null, kind !== "joined", current.org.shortName, CURRENT_SEASON),
      record,
      previous: prev ? toPrior(prev) : null,
      undated: undated.map(toPrior),
      priorOrgs,
      recordInferred: record.some((r) => r.inferred && r.startYear !== null),
      previousInferred: !!prev && !prev.yearsExplicit && prev.startYear !== null,
    });
  }
  return out;
}

/* ---------- Milestones ---------- */

/**
 * This season's milestones in Division III (§8.5): current football coaching stints whose start the
 * source states, in a 10th, 15th, 20th or 25th-and-later season of an unbroken run on one staff
 * (staffRun). Longest runs first. Cached like the moves (data only, no viewer).
 */
export const getAllFeedMilestones = cache(async (): Promise<FeedMilestone[]> => {
  try {
    return await buildFeedMilestones();
  } catch (err) {
    console.error("feed: cached milestones unreadable, deriving them again", err);
    return deriveFeedMilestones();
  }
});

const FEED_MILESTONES_VERSION = "1";

const buildFeedMilestones = unstable_cache((): Promise<FeedMilestone[]> => deriveFeedMilestones(), ["feed-milestones", String(CURRENT_SEASON), FEED_MILESTONES_VERSION], {
  revalidate: 600,
  tags: ["feed-moves"],
});

async function deriveFeedMilestones(): Promise<FeedMilestone[]> {
  // Candidates: a current coaching stint here with a stated start at least nine seasons back.
  const candidates = await db
    .select({ personId: tenures.personId })
    .from(tenures)
    .innerJoin(organizations, eq(organizations.id, tenures.orgId))
    .innerJoin(people, eq(people.id, tenures.personId))
    .where(
      and(
        eq(tenures.isCurrent, true),
        eq(tenures.asPlayer, false),
        eq(tenures.sport, "football"),
        eq(tenures.yearsExplicit, true),
        eq(organizations.level, FEED_LEVEL),
        eq(people.isDemo, false),
        sql`${tenures.startYear} <= ${CURRENT_SEASON - 9}`,
      ),
    );
  const ids = [...new Set(candidates.map((c) => c.personId))];
  if (!ids.length) return [];
  const [rows, persons] = await Promise.all([
    db
      .select(stintCols)
      .from(tenures)
      .innerJoin(organizations, eq(organizations.id, tenures.orgId))
      .where(inArray(tenures.personId, ids))
      .orderBy(tenures.personId, tenures.sortOrder, tenures.id),
    db.select(personCols).from(people).where(inArray(people.id, ids)),
  ]);
  type Stint = StintRow & MilestoneStint;
  const byPerson = groupByPerson<Stint>(rows);
  const out: FeedMilestone[] = [];
  for (const p of persons) {
    const stints = byPerson.get(p.id) ?? [];
    // One milestone per coach: the current D-III staff with the longest run.
    let best: { current: Stint; run: StaffRun<Stint> } | null = null;
    for (const current of stints) {
      if (!current.isCurrent || current.asPlayer || current.sport !== "football" || current.org.level !== FEED_LEVEL) continue;
      const run = staffRun(current, stints, CURRENT_SEASON);
      if (run && isMilestoneSeason(run.seasons) && (!best || run.seasons > best.run.seasons)) best = { current, run };
    }
    if (!best) continue;
    const { current, run } = best;
    const { toPrior } = stintShapes(p.sourceUrl);
    const first = run.run[0];
    const before = stopBefore(current, stints, run.firstSeason);
    out.push({
      key: `ms-${p.id}`,
      person: { id: p.id, slug: p.slug, fullName: p.fullName, firstName: p.firstName, almaMater: p.almaMater, claimed: p.claimed },
      org: toOrg(current.org),
      role: cleanTitle(current.role),
      roleGroup: current.roleGroup,
      seasons: run.seasons,
      firstSeason: run.firstSeason,
      firstRole: first.id !== current.id && cleanTitle(first.role) !== cleanTitle(current.role) ? cleanTitle(first.role) : null,
      roles: run.roles,
      otherStops: otherStops(current, stints),
      before: before ? toPrior(before) : null,
      sourceUrl: current.sourceUrl ?? p.sourceUrl,
    });
  }
  return out.sort((a, b) => b.seasons - a.seasons || stableHash(a.person.id) - stableHash(b.person.id));
}

/* ---------- Personal reasons ---------- */

/**
 * The stint behind a "coached (or played) at your program" reason when the move record doesn't show
 * it, so the card can back the reason up with a facts line. Null otherwise.
 */
export function formerStaffStint(move: FeedMove, reason: FeedReason | null, viewerOrgId: string | null): PriorStint | null {
  if (reason?.kind !== "formerStaff" || !viewerOrgId) return null;
  const before = move.priorOrgs[viewerOrgId];
  if (!before?.stint || move.record.some((r) => r.orgId === viewerOrgId)) return null;
  return before.stint;
}

/** Why a milestone is in the viewer's feed (program, head coach, colleague, school, conference), or null. */
export function milestoneReason(ms: FeedMilestone, viewer: FeedViewer): FeedReason | null {
  const org = viewer.org;
  if (viewer.headCoach && ms.person.id === viewer.headCoach.id) return { kind: "headCoach", subject: ms.person.fullName, text: "your head coach" };
  if (org && ms.org.id === org.id) return { kind: "program", subject: org.shortName, text: "your program" };
  const colleague = viewer.colleagues.find((c) => c.id === ms.person.id);
  if (colleague) return { kind: "colleague", subject: ms.person.fullName, text: `worked with you at ${colleague.edgeOrgShortName}` };
  const vSchool = schoolKey(viewer.almaMater);
  if (vSchool && schoolKey(ms.person.almaMater) === vSchool) return { kind: "alum", subject: schoolShort(viewer.almaMater!), text: "alum, like you" };
  if (org?.conferenceAbbr && ms.org.conferenceAbbr === org.conferenceAbbr) return { kind: "conference", subject: org.conferenceAbbr, text: "your conference" };
  return null;
}

/** Milestones in feed order for the viewer: personal reasons first, then the longest runs. */
function orderMilestones(list: FeedMilestone[], viewer: FeedViewer): { milestone: FeedMilestone; reason: FeedReason | null }[] {
  return list
    .map((milestone) => ({ milestone, reason: milestoneReason(milestone, viewer) }))
    .sort((a, b) => (a.reason ? REASON_RANK[a.reason.kind] : 9) - (b.reason ? REASON_RANK[b.reason.kind] : 9) || b.milestone.seasons - a.milestone.seasons);
}

const REASON_RANK: Record<ReasonKind, number> = { program: 0, headCoach: 1, colleague: 2, formerStaff: 3, alum: 4, conference: 5 };

/** Why this move is in the viewer's feed, from the session; null when there is no personal reason. */
export function reasonFor(move: FeedMove, viewer: FeedViewer): FeedReason | null {
  const org = viewer.org;
  if (org && move.org.id === org.id) return { kind: "program", subject: org.shortName, text: "your program" };
  if (viewer.headCoach && move.person.id === viewer.headCoach.id) return { kind: "headCoach", subject: move.person.fullName, text: "your head coach" };
  const colleague = viewer.colleagues.find((c) => c.id === move.person.id);
  if (colleague) return { kind: "colleague", subject: move.person.fullName, text: `worked with you at ${colleague.edgeOrgShortName}` };
  const before = org ? move.priorOrgs[org.id] : undefined;
  if (org && before) return { kind: "formerStaff", subject: org.shortName, text: before.playedOnly ? "played at your program" : "coached at your program" };
  const vSchool = schoolKey(viewer.almaMater);
  if (vSchool && schoolKey(move.person.almaMater) === vSchool) return { kind: "alum", subject: schoolShort(viewer.almaMater!), text: "alum, like you" };
  if (org?.conferenceAbbr && move.org.conferenceAbbr === org.conferenceAbbr) return { kind: "conference", subject: org.conferenceAbbr, text: "your conference" };
  return null;
}

const ROLE_RANK: Record<string, number> = { head_coach: 0, coordinator: 1, position_coach: 2, ga_analyst: 3, other: 4, support: 5, player: 6 };

function importance(m: FeedMove): number {
  const base = ROLE_RANK[m.roleGroup] ?? 4;
  return base * 10 + (m.kind === "promoted" ? 0 : 1) * 2 + (m.record.length ? 0 : 1);
}

function richness(m: FeedMove): number {
  if (m.previous && !m.previous.asPlayer && m.previous.startYear) return 0;
  if (m.previous && !m.previous.asPlayer) return 1;
  if (m.previous) return 2;
  return 3;
}

/** Stable, non-alphabetical tie-break, so equal-rank moves don't read as a list sorted by first name. */
const byHash = (a: FeedMove, b: FeedMove) => stableHash(a.person.id) - stableHash(b.person.id) || a.person.id.localeCompare(b.person.id);

type Ordered = {
  /** Full feed items (individual moves and grouped hires), in feed order. */
  full: FeedEntry[];
  /** The long tail of moves without a personal reason, richest first. */
  digest: FeedMove[];
};

/** Orders the season's moves for the viewer: personal and notable items as full cards, the rest as a digest. */
function orderMoves(moves: FeedMove[], viewer: FeedViewer): Ordered {
  const personal: { entry: FeedEntry; rank: number; imp: number; name: string }[] = [];
  const notable: FeedMove[] = [];
  const tail: FeedMove[] = [];
  const groupable = new Map<string, { move: FeedMove; reason: FeedReason }[]>();

  for (const m of moves) {
    const reason = reasonFor(m, viewer);
    if (reason) {
      // Several new assistants at one program in the viewer's conference read better as one program item.
      if (reason.kind === "conference" && m.kind === "joined" && m.roleGroup !== "head_coach" && m.roleGroup !== "coordinator") {
        const list = groupable.get(m.org.id) ?? [];
        list.push({ move: m, reason });
        groupable.set(m.org.id, list);
      } else {
        personal.push({ entry: { type: "move", key: m.key, move: m, reason }, rank: REASON_RANK[reason.kind], imp: importance(m), name: m.person.fullName });
      }
    } else if (m.roleGroup === "head_coach" || m.roleGroup === "coordinator" || m.kind === "promoted") {
      notable.push(m);
    } else {
      tail.push(m);
    }
  }
  for (const list of groupable.values()) {
    if (list.length >= 2) {
      const ms = list.map((x) => x.move).sort((a, b) => importance(a) - importance(b) || byHash(a, b));
      personal.push({
        entry: { type: "group", key: `g-${ms[0].org.id}`, org: ms[0].org, moves: ms, reason: list[0].reason, sourceUrl: ms.find((x) => x.sourceUrl)?.sourceUrl ?? null },
        rank: REASON_RANK.conference,
        imp: 25,
        name: ms[0].org.shortName,
      });
    } else {
      const { move, reason } = list[0];
      personal.push({ entry: { type: "move", key: move.key, move, reason }, rank: REASON_RANK.conference, imp: importance(move), name: move.person.fullName });
    }
  }
  personal.sort((a, b) => a.rank - b.rank || a.imp - b.imp || a.name.localeCompare(b.name));
  notable.sort((a, b) => importance(a) - importance(b) || byHash(a, b));
  tail.sort((a, b) => richness(a) - richness(b) || importance(a) - importance(b) || byHash(a, b));

  // Interleave: the most personal item first, then alternate with notable moves across the division.
  const full: FeedEntry[] = [];
  let p = 0;
  let n = 0;
  while (p < personal.length || n < notable.length) {
    if (p < personal.length) full.push(personal[p++].entry);
    if (n < notable.length) {
      const m = notable[n++];
      full.push({ type: "move", key: m.key, move: m, reason: null });
    }
  }
  return { full, digest: tail };
}

/* ---------- Jobs ---------- */

/** Open jobs for the feed (from getRecentJobs), ranked for the viewer, with network proof. */
export const getFeedJobs = cache(async (viewer: FeedViewer): Promise<FeedJob[]> => {
  const base = await getRecentJobs(200);
  if (!base.length) return [];
  const ids = base.map((j) => j.id);
  const details = await db
    .select({ id: jobs.id, isDemo: jobs.isDemo, org: orgCols })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(inArray(jobs.id, ids));
  const detailById = new Map(details.map((d) => [d.id, d]));
  const orgIds = [...new Set(details.map((d) => d.org.id))];

  // Network proof: the viewer's tree colleagues and current staff who played or coached at a job's program.
  const colleagueIds = new Set(viewer.colleagues.map((c) => c.id));
  if (viewer.org) {
    const staff = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.currentOrgId, viewer.org.id), eq(people.isDemo, false)));
    for (const s of staff) colleagueIds.add(s.id);
  }
  if (viewer.personId) colleagueIds.delete(viewer.personId);
  const ties =
    colleagueIds.size && orgIds.length
      ? await db
          .select({ personId: tenures.personId, orgId: tenures.orgId, asPlayer: tenures.asPlayer, slug: people.slug, fullName: people.fullName })
          .from(tenures)
          .innerJoin(people, eq(people.id, tenures.personId))
          .where(and(inArray(tenures.personId, [...colleagueIds]), inArray(tenures.orgId, orgIds), viewer.org ? ne(tenures.orgId, viewer.org.id) : undefined))
          .orderBy(people.fullName)
      : [];

  const viewerKeys = new Set(positionKeys(viewer.title));
  const out = base.map((j): FeedJob => {
    const d = detailById.get(j.id);
    const org = d ? toOrg(d.org) : toOrg({ id: j.org.slug, slug: j.org.slug, name: j.org.shortName, shortName: j.org.shortName, conference: null, conferenceAbbr: j.org.conferenceAbbr, level: j.org.level, city: null, state: j.org.state, inRegistry: true });
    const here = ties.filter((t) => t.orgId === org.id);
    const uniq = new Map<string, { slug: string; fullName: string; played: boolean; coached: boolean }>();
    for (const t of here) {
      const u = uniq.get(t.personId) ?? { slug: t.slug, fullName: t.fullName, played: false, coached: false };
      if (t.asPlayer) u.played = true;
      else u.coached = true;
      uniq.set(t.personId, u);
    }
    const list = [...uniq.values()];
    const verb = list.every((u) => u.played && !u.coached) ? "played" : list.every((u) => u.coached && !u.played) ? "coached" : "played or coached";
    return {
      id: j.id,
      title: j.title,
      roleGroup: j.roleGroup,
      employmentType: j.employmentType,
      isSample: j.source === "sample" || !!d?.isDemo,
      org,
      matchesPosition: positionKeys(j.title).some((k) => viewerKeys.has(k)),
      atViewerProgram: !!viewer.org && org.id === viewer.org.id,
      inViewerConference: !!viewer.org?.conferenceAbbr && org.conferenceAbbr === viewer.org.conferenceAbbr,
      network: list.length ? { people: list.slice(0, 3).map(({ slug, fullName }) => ({ slug, fullName })), total: list.length, verb } : null,
    };
  });
  // Stable rank: position-group matches, the viewer's program, the viewer's conference, then newest first.
  return out
    .map((j, i) => ({ j, i }))
    .sort(
      (a, b) =>
        Number(b.j.matchesPosition) - Number(a.j.matchesPosition) ||
        Number(b.j.atViewerProgram) - Number(a.j.atViewerProgram) ||
        Number(b.j.inViewerConference) - Number(a.j.inViewerConference) ||
        a.i - b.i,
    )
    .map((x) => x.j);
});

/* ---------- The feed page ---------- */

export type FeedPage = {
  filter: FeedFilter;
  /** The Moves filter narrowed to hires, promotions or other role changes. */
  kind: MoveFilterKind | null;
  page: number;
  totalPages: number;
  /** Items in display order (moves, grouped hires, milestones and jobs). */
  entries: FeedEntry[];
  /** "More staff moves" rows for this page. */
  digest: FeedMove[];
  /** Items for this filter in all, for the empty state. */
  total: number;
};

/** Where milestones and jobs sit among a page of the All feed. */
const JOB_SLOT = 3;
const MILESTONE_SLOT = 5;

type PageInputs = { moves: FeedMove[]; jobs: FeedJob[]; milestones: FeedMilestone[] };

/** The lists a filter needs (each cached), so a page and its bounds read the same data. */
async function pageInputs(viewer: FeedViewer, filter: FeedFilter, kind: MoveFilterKind | null): Promise<PageInputs> {
  const [moves, jobs, milestones] = await Promise.all([
    filter === "all" || filter === "moves" ? getAllFeedMoves() : Promise.resolve([] as FeedMove[]),
    filter === "all" || filter === "jobs" ? getFeedJobs(viewer) : Promise.resolve([] as FeedJob[]),
    filter === "all" || filter === "milestones" ? getAllFeedMilestones() : Promise.resolve([] as FeedMilestone[]),
  ]);
  return { moves: filter === "moves" ? moves.filter((m) => matchesKind(m, kind)) : moves, jobs, milestones };
}

function countPages(filter: FeedFilter, { moves, jobs, milestones }: PageInputs, ordered: Ordered | null): number {
  if (filter === "jobs") return Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
  if (filter === "milestones") return Math.max(1, Math.ceil(milestones.length / MILESTONES_PER_PAGE));
  if (!ordered || !moves.length) return 1;
  return Math.max(1, Math.ceil(ordered.full.length / FULL_PER_PAGE), Math.ceil(ordered.digest.length / DIGEST_PER_PAGE));
}

/**
 * How many pages a filter has, for the page's bounds check before anything streams (a page past
 * the end is a real 404). Reads the cached lists only; no rendering work.
 */
export async function getFeedTotalPages(viewer: FeedViewer, filter: FeedFilter, kind: MoveFilterKind | null): Promise<number> {
  const inputs = await pageInputs(viewer, filter, kind);
  const ordered = filter === "all" || filter === "moves" ? orderMoves(inputs.moves, viewer) : null;
  return countPages(filter, inputs, ordered);
}

/** One page of the viewer's feed. */
export async function getFeedPage(viewer: FeedViewer, filter: FeedFilter, page: number, kind: MoveFilterKind | null = null): Promise<FeedPage> {
  const inputs = await pageInputs(viewer, filter, kind);
  const { moves, jobs: jobList, milestones } = inputs;

  if (filter === "jobs") {
    const slice = jobList.slice((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE);
    return {
      filter,
      kind: null,
      page,
      totalPages: countPages(filter, inputs, null),
      entries: slice.map((job) => ({ type: "job", key: `j-${job.id}`, job })),
      digest: [],
      total: jobList.length,
    };
  }

  if (filter === "milestones") {
    const slice = orderMilestones(milestones, viewer).slice((page - 1) * MILESTONES_PER_PAGE, page * MILESTONES_PER_PAGE);
    return {
      filter,
      kind: null,
      page,
      totalPages: countPages(filter, inputs, null),
      entries: slice.map(({ milestone, reason }) => ({ type: "milestone", key: milestone.key, milestone, reason })),
      digest: [],
      total: milestones.length,
    };
  }

  const ordered = orderMoves(moves, viewer);
  const { full, digest } = ordered;
  const fullSlice = full.slice((page - 1) * FULL_PER_PAGE, page * FULL_PER_PAGE);
  const digestSlice = digest.slice((page - 1) * DIGEST_PER_PAGE, page * DIGEST_PER_PAGE).sort((a, b) => a.org.shortName.localeCompare(b.org.shortName) || importance(a) - importance(b) || byHash(a, b));

  const entries: FeedEntry[] = [...fullSlice];
  if (filter === "all") {
    // One job per page after the third item, and one milestone after the fifth (or at the end of a short page).
    const ms = orderMilestones(milestones, viewer)[page - 1];
    if (ms) entries.splice(Math.min(MILESTONE_SLOT - 1, entries.length), 0, { type: "milestone", key: ms.milestone.key, milestone: ms.milestone, reason: ms.reason });
    const job = jobList[page - 1];
    if (job) entries.splice(Math.min(JOB_SLOT, entries.length), 0, { type: "job", key: `j-${job.id}`, job });
  }
  return {
    filter,
    kind: filter === "moves" ? kind : null,
    page,
    totalPages: countPages(filter, inputs, ordered),
    entries,
    digest: digestSlice,
    total: filter === "all" ? moves.length + jobList.length + milestones.length : moves.length,
  };
}

/* ---------- Carousel tracker ---------- */

export type TrackerRow = { conference: string; name: string | null; hires: number; promotions: number; isViewer: boolean };

export type CarouselTracker = {
  season: number;
  programs: number;
  /** New to the program, including returns after time away. */
  hires: number;
  /** A more senior role at the same program (moves that aren't clearly a step up count in neither). */
  promotions: number;
  /** Other role changes at the same program (sideways or unclear): in the Moves list, in neither KPI. */
  otherMoves: number;
  /** Open Division III jobs, the same number on the rail and the phone summary. */
  openJobs: number;
  /** How many of those are sample listings (the "Sample" chip shows while any are). */
  sampleJobs: number;
  /** Top five conferences by hires (ties by promotions). */
  rows: TrackerRow[];
  /** The viewer's conference when it is not in the top five. */
  viewerRow: TrackerRow | null;
  /** Bar scale. */
  max: number;
};

const isHire = (m: FeedMove) => m.kind === "joined" || m.kind === "returned";

/**
 * Numbers for the right-rail tracker, from the same classified moves the cards show: hires (new to
 * the program, returns included) and promotions (a more senior role at the same program).
 */
export async function getCarouselTracker(viewer: FeedViewer): Promise<CarouselTracker> {
  const [moves, [{ programs }], [{ open, sample }]] = await Promise.all([
    getAllFeedMoves(),
    db
      .select({ programs: sql<number>`count(distinct ${people.currentOrgId})::int` })
      .from(people)
      .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(and(eq(organizations.level, FEED_LEVEL), eq(people.isDemo, false))),
    db
      .select({
        open: count(),
        sample: sql<number>`count(*) filter (where ${jobs.source} = 'sample' or ${jobs.isDemo})::int`,
      })
      .from(jobs)
      .innerJoin(organizations, eq(organizations.id, jobs.orgId))
      .where(and(eq(jobs.status, "open"), eq(organizations.level, FEED_LEVEL))),
  ]);
  const byConf = new Map<string, TrackerRow>();
  for (const m of moves) {
    const c = m.org.conferenceAbbr;
    if (!c) continue;
    const row = byConf.get(c) ?? { conference: c, name: m.org.conference, hires: 0, promotions: 0, isViewer: false };
    if (m.kind === "promoted") row.promotions++;
    else if (isHire(m)) row.hires++;
    else continue;
    byConf.set(c, row);
  }
  const viewerConf = viewer.org?.conferenceAbbr ?? null;
  const sorted = [...byConf.values()].sort((a, b) => b.hires - a.hires || b.promotions - a.promotions || a.conference.localeCompare(b.conference));
  const rows = sorted.slice(0, 5).map((r) => ({ ...r, isViewer: r.conference === viewerConf }));
  let viewerRow: TrackerRow | null = null;
  if (viewerConf && !rows.some((r) => r.isViewer)) {
    const r = byConf.get(viewerConf);
    viewerRow = { conference: viewerConf, name: r?.name ?? viewer.org?.conference ?? null, hires: r?.hires ?? 0, promotions: r?.promotions ?? 0, isViewer: true };
  }
  const max = Math.max(1, ...rows.map((r) => r.hires), viewerRow?.hires ?? 0);
  return {
    season: CURRENT_SEASON,
    programs,
    hires: moves.filter(isHire).length,
    promotions: moves.filter((m) => m.kind === "promoted").length,
    otherMoves: moves.filter((m) => m.kind === "moved").length,
    openJobs: open,
    sampleJobs: sample,
    rows,
    viewerRow,
    max,
  };
}

/* ---------- People you may know ---------- */

export type PymkRow = {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
  orgShortName: string | null;
  claimed: boolean;
  /** The reason, shown as a ContextLine. */
  context: string;
  contextKind: "tree" | "school" | "info" | "conference";
  /** Someone the viewer already worked with: unclaimed ones get "Invite to claim" instead of Connect. */
  known: boolean;
};

const summaryCols = {
  id: people.id,
  slug: people.slug,
  fullName: people.fullName,
  currentTitle: people.currentTitle,
  roleGroup: people.roleGroup,
  claimed: people.claimed,
  orgShortName: organizations.shortName,
  orgLevel: organizations.level,
};

/**
 * Up to 3 people for the rail: the viewer's head coach (from getRelated, the coaching tree), one
 * coach two steps away through a colleague, one alum of the viewer's school, then coaches in the
 * viewer's conference as the fallback.
 */
export async function getPeopleYouMayKnow(viewer: FeedViewer, limit = 3): Promise<PymkRow[]> {
  const exclude = new Set<string>([...(viewer.personId ? [viewer.personId] : []), ...viewer.colleagues.map((c) => c.id)]);
  const rows: PymkRow[] = [];
  const taken = new Set<string>();
  const push = (r: PymkRow) => {
    if (taken.has(r.id) || rows.length >= limit) return;
    taken.add(r.id);
    rows.push(r);
  };

  const related = viewer.personId ? await getRelated(viewer.personId, 12) : [];
  // The program's head coach: from the coaching tree for a coach, or directly for an athletic director.
  const head = viewer.headCoach
    ? (related.find((p) => p.id === viewer.headCoach!.id) ?? (viewer.personId ? undefined : (await getPeopleSummaries([viewer.headCoach.id])).get(viewer.headCoach.id)))
    : undefined;
  if (head) {
    push({
      id: head.id,
      slug: head.slug,
      fullName: head.fullName,
      title: cleanTitle(head.currentTitle) || null,
      orgShortName: head.org?.shortName ?? null,
      claimed: head.claimed,
      // To an athletic director the head coach is the program's, not "yours".
      context: `${viewer.role === "employer" && viewer.org ? `${viewer.org.shortName} head coach` : "Your head coach"}${head.claimed ? "" : " · hasn't claimed a profile"}`,
      contextKind: "info",
      known: true,
    });
  }

  // Two steps away: people who worked with the viewer's colleagues, newest overlap first, head coaches first.
  const colleagueIds = viewer.colleagues.map((c) => c.id);
  if (colleagueIds.length) {
    const edges = await db
      .select({
        mentorId: treeEdges.mentorId,
        menteeId: treeEdges.menteeId,
        endYear: treeEdges.endYear,
        orgShortName: organizations.shortName,
      })
      .from(treeEdges)
      .innerJoin(organizations, eq(organizations.id, treeEdges.orgId))
      .where(or(inArray(treeEdges.mentorId, colleagueIds), inArray(treeEdges.menteeId, colleagueIds)))
      .orderBy(sql`${treeEdges.endYear} desc nulls last`)
      .limit(400);
    const candidates = new Map<string, { via: string; org: string }>();
    for (const e of edges) {
      const colleagueSide = colleagueIds.includes(e.mentorId) ? e.mentorId : e.menteeId;
      const other = colleagueSide === e.mentorId ? e.menteeId : e.mentorId;
      if (exclude.has(other) || candidates.has(other)) continue;
      candidates.set(other, { via: colleagueSide, org: e.orgShortName });
    }
    if (candidates.size) {
      const ppl = await db
        .select(summaryCols)
        .from(people)
        .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
        .where(and(inArray(people.id, [...candidates.keys()]), eq(people.isDemo, false)));
      const order = [...candidates.keys()];
      ppl.sort((a, b) => (ROLE_RANK[a.roleGroup ?? "other"] ?? 4) - (ROLE_RANK[b.roleGroup ?? "other"] ?? 4) || order.indexOf(a.id) - order.indexOf(b.id));
      const p = ppl[0];
      if (p) {
        const c = candidates.get(p.id)!;
        const via = viewer.colleagues.find((x) => x.id === c.via);
        push({
          id: p.id,
          slug: p.slug,
          fullName: p.fullName,
          title: cleanTitle(p.currentTitle) || null,
          orgShortName: p.orgShortName,
          claimed: p.claimed,
          context: `Via ${via?.fullName ?? "a colleague"} · worked together at ${c.org}`,
          contextKind: "tree",
          known: false,
        });
      }
    }
  }

  // An alum of the viewer's school.
  const vSchool = schoolKey(viewer.almaMater);
  if (vSchool && viewer.almaMater) {
    const alumni = await db
      .select(summaryCols)
      .from(people)
      .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(and(ilike(people.almaMater, `%${schoolShort(viewer.almaMater).replace(/[%_]/g, "")}%`), eq(people.isDemo, false)))
      .limit(50);
    const match = alumni
      .filter((a) => !exclude.has(a.id) && !taken.has(a.id))
      .sort((a, b) => Number(b.orgLevel === FEED_LEVEL) - Number(a.orgLevel === FEED_LEVEL) || (ROLE_RANK[a.roleGroup ?? "other"] ?? 4) - (ROLE_RANK[b.roleGroup ?? "other"] ?? 4) || a.fullName.localeCompare(b.fullName));
    const a = match[0];
    if (a) {
      push({
        id: a.id,
        slug: a.slug,
        fullName: a.fullName,
        title: cleanTitle(a.currentTitle) || null,
        orgShortName: a.orgShortName,
        claimed: a.claimed,
        context: `${schoolShort(viewer.almaMater)} alum, like you`,
        contextKind: "school",
        known: false,
      });
    }
  }

  // Fallback: head coaches and coordinators elsewhere in the viewer's conference.
  if (rows.length < limit && viewer.org?.conference) {
    const conf = await db
      .select(summaryCols)
      .from(people)
      .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(
        and(
          eq(organizations.conference, viewer.org.conference),
          ne(organizations.id, viewer.org.id),
          inArray(people.roleGroup, ["head_coach", "coordinator"]),
          eq(people.isDemo, false),
        ),
      )
      .orderBy(sql`case ${people.roleGroup} when 'head_coach' then 0 else 1 end`, organizations.shortName, people.fullName)
      .limit(12);
    for (const p of conf) {
      if (exclude.has(p.id)) continue;
      push({
        id: p.id,
        slug: p.slug,
        fullName: p.fullName,
        title: cleanTitle(p.currentTitle) || null,
        orgShortName: p.orgShortName,
        claimed: p.claimed,
        context: `${viewer.org.conferenceAbbr ?? "Conference"} · your conference`,
        contextKind: "conference",
        known: false,
      });
    }
  }

  // Last: other colleagues from the tree.
  for (const p of related) {
    if (rows.length >= limit) break;
    const c = viewer.colleagues.find((x) => x.id === p.id);
    push({
      id: p.id,
      slug: p.slug,
      fullName: p.fullName,
      title: cleanTitle(p.currentTitle) || null,
      orgShortName: p.org?.shortName ?? null,
      claimed: p.claimed,
      context: `Worked with you at ${c?.edgeOrgShortName ?? "your program"}${p.claimed ? "" : " · hasn't claimed a profile"}`,
      contextKind: "tree",
      known: true,
    });
  }
  return rows;
}

/* ---------- Mini profile ---------- */

export type MiniProfileStats = {
  profileViewers: number;
  searchAppearances: number;
  treeSize: number;
};

/** A stable demo number for a person (labelled "demo data" wherever it shows). */
function demoNumber(seed: string, min: number, span: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return min + (h % span);
}

/** Left-rail numbers: profile viewers (past 7 days), search appearances (demo) and the coaching-tree size. */
export async function getMiniProfileStats(viewer: FeedViewer): Promise<MiniProfileStats | null> {
  if (!viewer.personId) return null;
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [[views], [tree]] = await Promise.all([
    db
      .select({ n: sql<number>`count(distinct coalesce(${profileViews.viewerUserId}, ${profileViews.id}::text))::int` })
      .from(profileViews)
      .where(and(eq(profileViews.personId, viewer.personId), gte(profileViews.viewedAt, since))),
    db
      .select({ n: sql<number>`count(distinct case when ${treeEdges.mentorId} = ${viewer.personId} then ${treeEdges.menteeId} else ${treeEdges.mentorId} end)::int` })
      .from(treeEdges)
      .where(or(eq(treeEdges.mentorId, viewer.personId), eq(treeEdges.menteeId, viewer.personId))),
  ]);
  const seed = viewer.slug ?? viewer.personId;
  return {
    profileViewers: views?.n || demoNumber(`${seed}:views`, 24, 40),
    searchAppearances: demoNumber(`${seed}:search`, 80, 90),
    treeSize: tree?.n ?? 0,
  };
}

/* ---------- Shortcuts ---------- */

export type FollowedProgram = { id: string; slug: string; shortName: string; name: string; inRegistry: boolean };

/** Programs the signed-in demo user follows (Follow on a program page), in the order followed. */
export async function getFollowedPrograms(userId: string): Promise<FollowedProgram[]> {
  const ids = await getFollowedOrgIds(userId);
  if (!ids.length) return [];
  const rows = await db
    .select({ id: organizations.id, slug: organizations.slug, shortName: organizations.shortName, name: organizations.name, inRegistry: organizations.inRegistry })
    .from(organizations)
    .where(inArray(organizations.id, ids));
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
