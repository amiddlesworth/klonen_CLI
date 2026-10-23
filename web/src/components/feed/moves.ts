/*
 * How a stint that starts this season reads in the feed (pure, shared by the feed queries and tests).
 * A move is only called a promotion when the source supports it: the coach held a less senior role at
 * the same program through last season. Everything else gets the plainest true wording.
 */
import { roleRank, sameTitle } from "./text";

/**
 * joined: new to the program. returned: back at a program after time away, or after an undated
 * earlier role there when the coach was elsewhere last season (counts as a hire).
 * promoted: a more senior role at the same program after last season. moved: a different role at the
 * same program that isn't clearly more senior (sideways, a step back, or an undated earlier role).
 */
export type MoveKind = "joined" | "returned" | "promoted" | "moved";

/** The fields of a stint the classification reads. */
export type StintFacts = {
  id: number;
  orgId: string;
  role: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  asPlayer: boolean;
  sport: string;
  sortOrder: number;
};

/** The last season a stint is known to cover (its end year, else its start year); null when undated. */
export function lastSeason(s: Pick<StintFacts, "startYear" | "endYear">): number | null {
  return s.endYear ?? s.startYear;
}

/** Latest known season first; undated stints last, in source order. */
export function byRecency(a: StintFacts, b: StintFacts): number {
  return (lastSeason(b) ?? -Infinity) - (lastSeason(a) ?? -Infinity) || a.sortOrder - b.sortOrder || a.id - b.id;
}

/**
 * Past football stints before this season, latest first. Other sports and stints that start this
 * season (a second job held alongside the new one) are left out: neither is a previous role.
 */
export function pastStints<T extends StintFacts>(stints: T[], currentId: number, season: number, asPlayer: boolean): T[] {
  return stints
    .filter((s) => s.id !== currentId && !s.isCurrent && s.asPlayer === asPlayer && s.sport === "football" && !(s.startYear !== null && s.startYear >= season))
    .sort(byRecency);
}

/**
 * Reads a new stint against the coach's past coaching stints (from pastStints). Returns "continued"
 * when the source only restates the same role at the same program, which is not a move at all
 * ("Head coach 2010–2025" then "Head coach 2026").
 */
export function classifyMove(current: StintFacts, prior: StintFacts[], season: number): MoveKind | "continued" {
  const same = prior.filter((s) => s.orgId === current.orgId);
  const recent = same.filter((s) => (lastSeason(s) ?? -Infinity) >= season - 1);
  if (recent.length) {
    if (recent.some((s) => sameTitle(s.role, current.role))) return "continued";
    const ranks = recent.map((s) => roleRank(s.role)).filter((r): r is number => r !== null);
    const was = ranks.length ? Math.min(...ranks) : null;
    const now = roleRank(current.role);
    return now !== null && was !== null && now < was ? "promoted" : "moved";
  }
  // At the program before, with at least one season away since: a return.
  if (same.some((s) => lastSeason(s) !== null)) return "returned";
  if (same.length) {
    // Only undated roles here before. If the coach was elsewhere last season, the earlier role here
    // came before that: a return (still a hire). Otherwise when it ended is unknown, so it's only a
    // different role.
    const elsewhere = prior.some((s) => s.orgId !== current.orgId && (lastSeason(s) ?? -Infinity) >= season - 1);
    return elsewhere ? "returned" : "moved";
  }
  return "joined";
}

/**
 * Up to `n` dated stints for a move record (the latest ones), oldest first. Undated stints never go
 * in the record: its year column is its point, and an undated row can't be placed in order. The card
 * names them in one facts line instead (see undatedStints).
 */
export function recordStints<T extends StintFacts>(list: T[], n: number): T[] {
  return list
    .filter((s) => lastSeason(s) !== null)
    .sort(byRecency)
    .slice(0, n)
    .sort((a, b) => {
      const la = lastSeason(a)!;
      const lb = lastSeason(b)!;
      return (a.startYear ?? la) - (b.startYear ?? lb) || la - lb;
    });
}

/** Stints with no year in the source, in source order (the order the bio lists them, not a timeline). */
export function undatedStints<T extends StintFacts>(list: T[]): T[] {
  return list.filter((s) => lastSeason(s) === null).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** A past stint's last season as shown next to a new role: never the new role's season or later. */
export function shownEnd(endYear: number | null, season: number): number | null {
  return endYear !== null && endYear >= season ? season - 1 : endYear;
}
