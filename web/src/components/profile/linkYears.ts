/*
 * What a coaching-tree link's years can honestly show (DESIGN.md §6.1, §6.2, §12). Pure: no data access.
 *
 * tree_edges stores one row per contiguous run of shared seasons, computed by the pipeline from each
 * person's season coverage at the organization (pipeline/resolve.py span() and build_edges()). Coverage
 * fills gaps the source leaves open: a current stint with no start year covers the current season, a past
 * stint with only an end year covers that year, a past stint with only a start year covers that year. So an
 * edge's start or end year is not always a year the source gave. This module goes back to both people's
 * stints at the organization and works out, for each end of the run:
 *  - whether the source pins it (a bound that comes only from a filled-in year is not known), and
 *  - whether it comes from a stint with yearsExplicit = false (inferred: dotted underline, §6.2).
 */
import { CURRENT_SEASON } from "@/lib/brand";

export type YearStint = {
  personId: string;
  orgId: string;
  roleGroup: string;
  sport: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  asPlayer: boolean;
  yearsExplicit: boolean;
  evidence: string | null;
};

export type LinkYears = {
  /** The shared seasons run through the current season. */
  ongoing: boolean;
  /** First shared season, only when the source pins it (null: e.g. an undated current stint). */
  startYear: number | null;
  /** Last shared season, only when not ongoing and the source pins it. */
  endYear: number | null;
  /** A shown year comes from a stint with yearsExplicit = false. */
  inferred: boolean;
  /** Whose stint the inferred year comes from, and its evidence quote (for the tooltip). */
  inferredFrom: { personId: string; evidence: string | null } | null;
  /**
   * Per bound: the shown start (or end) year comes from a stint with yearsExplicit = false, so only that
   * year carries the dotted mark ("2020–", "2016–19" with just the inferred side dotted). Absent on links
   * built without the bounds (treated as `inferred` on the start).
   */
  startInferred?: boolean;
  endInferred?: boolean;
  /** The stint each inferred bound comes from (for its own tooltip). */
  startFrom?: { personId: string; evidence: string | null } | null;
  endFrom?: { personId: string; evidence: string | null } | null;
};

/** How the years read in a compact row: a range ("2010–12", "2020–"), "Current" (start not in source), or nothing. */
export type LinkYearsDisplay = "range" | "current" | "none";

export function linkYearsDisplay(y: LinkYears): LinkYearsDisplay {
  if (y.ongoing) return y.startYear ? "range" : "current";
  return y.startYear && y.endYear ? "range" : "none";
}

/** Seasons a stint covers, exactly as the pipeline counts them (resolve.py span()). */
export function coverage(t: Pick<YearStint, "startYear" | "endYear" | "isCurrent">): [number, number] | null {
  const s = t.startYear;
  const e = t.endYear;
  if (t.isCurrent) return [s === null ? CURRENT_SEASON : Math.min(s, CURRENT_SEASON), CURRENT_SEASON];
  if (s === null && e === null) return null;
  if (s === null) return [e!, e!];
  if (e === null) return [s, s];
  return e >= s ? [s, e] : [s, s];
}

const covers = (t: YearStint, y: number) => {
  const c = coverage(t);
  return !!c && c[0] <= y && y <= c[1];
};

/** Stints that can form tree edges (resolve.py edge_eligible). */
export const edgeEligible = (t: YearStint) => !t.asPlayer && t.sport === "football" && t.roleGroup !== "other" && t.roleGroup !== "player";
const isHead = (t: YearStint) => t.roleGroup === "head_coach";

/**
 * One side of a shared run: the stints that count for it and the seasons it covers. For an assistant side
 * the pipeline subtracts the person's own head-coach seasons, so `covers` does the same.
 */
export type Side = { personId: string; stints: YearStint[]; covers: (y: number) => boolean };

/** The head-coach side of "worked under" (or of "played for"). */
export function headSide(personId: string, stints: YearStint[]): Side {
  const head = stints.filter((t) => t.personId === personId && edgeEligible(t) && isHead(t));
  return { personId, stints: head, covers: (y) => head.some((t) => covers(t, y)) };
}

/** A staff side (assistant seasons, minus the person's own head-coach seasons). */
export function staffSide(personId: string, stints: YearStint[]): Side {
  const mine = stints.filter((t) => t.personId === personId && edgeEligible(t));
  const staff = mine.filter((t) => !isHead(t));
  const head = mine.filter(isHead);
  return { personId, stints: staff, covers: (y) => staff.some((t) => covers(t, y)) && !head.some((t) => covers(t, y)) };
}

/** A playing side (asPlayer football stints). */
export function playerSide(personId: string, stints: YearStint[]): Side {
  const played = stints.filter((t) => t.personId === personId && t.asPlayer && t.sport === "football");
  return { personId, stints: played, covers: (y) => played.some((t) => covers(t, y)) };
}

type Bound = { known: boolean; inferred: boolean; from: YearStint | null };

/**
 * The status of one bound of a run, from the sides whose coverage begins (or ends) there. A side whose
 * bound is a filled-in year still pins nothing; but when another side's bound is a real year, the run's
 * bound is that year (a current stint with no start year began at or before this season, so the later,
 * known start decides). Known when any bounding side is known; inferred when a known bounding side is.
 */
function bound(sides: Side[], year: number, edge: "start" | "end"): Bound {
  const outside = edge === "start" ? year - 1 : year + 1;
  const bounding = sides.filter((s) => !s.covers(outside));
  if (!bounding.length) {
    // Not a boundary of either side's coverage (data the pipeline would not produce): treat it as known,
    // inferred when any stint covering it is.
    const covering = sides.flatMap((s) => s.stints.filter((t) => covers(t, year)));
    const inf = covering.find((t) => !t.yearsExplicit) ?? null;
    return { known: true, inferred: !!inf, from: inf };
  }
  const statuses: Bound[] = bounding.map((s) => {
    const at = s.stints.filter((t) => {
      const c = coverage(t);
      return !!c && (edge === "start" ? c[0] === year : c[1] === year);
    });
    if (!at.length) {
      // The bound comes from the other side of the subtraction (the person's own head-coach seasons).
      const covering = s.stints.filter((t) => covers(t, year));
      const inf = covering.find((t) => !t.yearsExplicit) ?? null;
      return { known: true, inferred: !!inf, from: inf };
    }
    const known = at.filter((t) => (edge === "start" ? t.startYear === year : t.endYear !== null && !t.isCurrent));
    if (!known.length) return { known: false, inferred: false, from: null };
    const explicit = known.find((t) => t.yearsExplicit);
    return explicit ? { known: true, inferred: false, from: explicit } : { known: true, inferred: true, from: known[0] };
  });
  const known = statuses.filter((b) => b.known);
  if (!known.length) return { known: false, inferred: false, from: null };
  const inf = known.find((b) => b.inferred);
  return inf ?? known[0];
}

/** The years of one shared run [lo, hi] between two sides. */
export function runYears(a: Side, b: Side, lo: number, hi: number): LinkYears {
  const ongoing = hi >= CURRENT_SEASON;
  const start = bound([a, b], lo, "start");
  const end = ongoing ? null : bound([a, b], hi, "end");
  const showStart = start.known && (ongoing || !!end?.known);
  const showEnd = !ongoing && start.known && !!end?.known;
  const inferredBound = [showStart ? start : null, showEnd ? end : null].find((x) => x?.inferred) ?? null;
  const ref = (b: Bound | null) => (b?.from ? { personId: b.from.personId, evidence: b.from.evidence } : null);
  const startInferred = showStart && start.inferred;
  const endInferred = showEnd && !!end?.inferred;
  return {
    ongoing,
    startYear: showStart ? lo : null,
    endYear: showEnd ? hi : null,
    inferred: !!inferredBound,
    inferredFrom: ref(inferredBound),
    startInferred,
    endInferred,
    startFrom: startInferred ? ref(start) : null,
    endFrom: endInferred ? ref(end) : null,
  };
}

/** A stored tree edge (tree_edges row). */
export type EdgeRef = { kind: "worked_under" | "worked_alongside"; mentorId: string; menteeId: string; orgId: string; startYear: number | null; endYear: number | null };

/** The years of a stored edge, from both people's stints at its organization. */
export function edgeYears(edge: EdgeRef, stints: YearStint[]): LinkYears {
  const here = stints.filter((t) => t.orgId === edge.orgId);
  const a = edge.kind === "worked_under" ? headSide(edge.mentorId, here) : staffSide(edge.mentorId, here);
  const b = staffSide(edge.menteeId, here);
  const lo = edge.startYear ?? edge.endYear;
  const hi = edge.endYear ?? edge.startYear;
  if (lo === null || hi === null) return { ongoing: false, startYear: null, endYear: null, inferred: false, inferredFrom: null };
  return runYears(a, b, lo, hi);
}

/** Contiguous runs of seasons both sides cover, most recent first. */
export function sharedRuns(a: Side, b: Side): [number, number][] {
  const years = new Set<number>();
  for (const t of a.stints) {
    const c = coverage(t);
    if (!c) continue;
    for (let y = c[0]; y <= c[1]; y++) if (a.covers(y) && b.covers(y)) years.add(y);
  }
  const sorted = [...years].sort((x, y) => x - y);
  const runs: [number, number][] = [];
  for (const y of sorted) {
    const last = runs[runs.length - 1];
    if (last && y === last[1] + 1) last[1] = y;
    else runs.push([y, y]);
  }
  return runs.reverse();
}

/**
 * The most recent run of seasons one person played at an organization while the other was its head
 * coach ("Played for Ian 2024–25"), or null when they never overlapped there.
 */
export function playedUnder(playerId: string, coachId: string, stints: YearStint[]): LinkYears | null {
  const orgs = new Set(stints.filter((t) => t.personId === playerId && t.asPlayer).map((t) => t.orgId));
  let best: { run: [number, number]; years: LinkYears } | null = null;
  for (const orgId of orgs) {
    const here = stints.filter((t) => t.orgId === orgId);
    const player = playerSide(playerId, here);
    const coach = headSide(coachId, here);
    const run = sharedRuns(player, coach)[0];
    if (run && (!best || run[1] > best.run[1])) best = { run, years: runYears(player, coach, run[0], run[1]) };
  }
  return best?.years ?? null;
}
