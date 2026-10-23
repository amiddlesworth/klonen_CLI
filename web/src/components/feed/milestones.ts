/*
 * Milestones (DESIGN.md §8.5, PRODUCT_SPEC P0 #2): a coach's 10th, 15th, 20th or 25th-and-later
 * season on one staff, derived from tenures (pure, shared by the feed queries and tests). A milestone
 * is only claimed when the source states the years: every stint that sets the first season must have
 * explicit years, and an earlier role at the program whose years are missing or unclear (so it may
 * belong to the same run) means the count can't be stated, so there is no milestone.
 */
import { byRecency, lastSeason, type StintFacts } from "./moves";
import { titleKey } from "./text";

export type MilestoneStint = StintFacts & { yearsExplicit: boolean };

/** Seasons on one staff that make a milestone: 10, 15, 20, then every season from the 25th. */
export function isMilestoneSeason(n: number): boolean {
  return n === 10 || n === 15 || n === 20 || n >= 25;
}

export type StaffRun<T extends MilestoneStint> = {
  /** The first season of the unbroken run of roles at the program that leads to the current one. */
  firstSeason: number;
  /** This season's place in that run: 42 for a coach there since 1985 in 2026. */
  seasons: number;
  /** The stints in the run, oldest first. */
  run: T[];
  /** Distinct roles held in the run. */
  roles: number;
};

const coaching = (s: StintFacts) => !s.asPlayer && s.sport === "football";

/**
 * The unbroken run of coaching roles at the current stint's program, if the source supports a
 * season count: null when the current stint's start isn't stated, when an earlier role in the run
 * has inferred years, when another role at the program has no years or no end (it may be part of
 * the run), or when there was time away (an earlier, separate stint makes "Nth season on the staff"
 * ambiguous).
 */
export function staffRun<T extends MilestoneStint>(current: T, stints: T[], season: number): StaffRun<T> | null {
  if (current.startYear === null || !current.yearsExplicit || current.startYear > season) return null;
  const same = stints.filter((s) => s.id !== current.id && s.orgId === current.orgId && coaching(s));
  const run: T[] = [current];
  let first = current.startYear;
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of same) {
      if (run.includes(s) || s.startYear === null) continue;
      const end = s.isCurrent ? season : s.endYear;
      if (s.startYear >= first) {
        // Within the run already (a second title held alongside): part of it.
        run.push(s);
        continue;
      }
      if (end !== null && end >= first - 1) {
        if (!s.yearsExplicit) return null;
        first = s.startYear;
        run.push(s);
        grew = true;
      }
    }
  }
  // Anything left at this program is undated, open-ended or separate: the count would be a guess.
  if (same.some((s) => !run.includes(s))) return null;
  run.sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0) || a.sortOrder - b.sortOrder);
  return { firstSeason: first, seasons: season - first + 1, run, roles: new Set(run.map((s) => titleKey(s.role) || s.role)).size };
}

/** Distinct other programs in the coach's football coaching record (stops before or alongside this one). */
export function otherStops<T extends MilestoneStint>(current: T, stints: T[]): number {
  return new Set(stints.filter((s) => coaching(s) && s.orgId !== current.orgId).map((s) => s.orgId)).size;
}

/** The coaching stint elsewhere that came right before the run: the latest dated one, else the first undated one the bio lists. */
export function stopBefore<T extends MilestoneStint>(current: T, stints: T[], firstSeason: number): T | null {
  const other = stints.filter((s) => coaching(s) && s.orgId !== current.orgId);
  const dated = other.filter((s) => {
    const last = lastSeason(s);
    return last !== null && last <= firstSeason;
  });
  if (dated.length) return [...dated].sort(byRecency)[0];
  return other.filter((s) => lastSeason(s) === null).sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
}
