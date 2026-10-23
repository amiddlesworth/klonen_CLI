/*
 * Time order for the second level of the tree (DESIGN.md §8.8, ?depth=2). Pure: no data access.
 *
 * "Two steps up" means the coach's head coach had worked under someone before (or while) coaching the
 * coach; a link the mentor formed years later is not part of the coach's lineage. "Two steps down" means
 * someone worked under one of the coach's former assistants after that assistant joined the coach's staff.
 * Years are the stored overlap runs (tree_edges); a missing year never rules a link out.
 */

export type RunYears = { startYear: number | null; endYear: number | null };

/**
 * Up: the coach worked under `via` during `first`; `via` worked under someone during `grand`. Kept when
 * the grand run starts on or before a first-level run ends.
 */
export function upInLineage(first: RunYears, grand: RunYears): boolean {
  return grand.startYear === null || first.endYear === null || grand.startYear <= first.endYear;
}

/**
 * Down: `via` coached under the coach during `first`; someone coached under `via` during `grand`. Kept
 * when the grand run ends on or after a first-level run starts.
 */
export function downInLineage(first: RunYears, grand: RunYears): boolean {
  return grand.endYear === null || first.startYear === null || grand.endYear >= first.startYear;
}

/** The grand runs that belong to the lineage through any of the first-level runs. */
export function lineageRuns<T extends RunYears>(direction: "up" | "down", firsts: RunYears[], grands: T[]): T[] {
  const ok = direction === "up" ? upInLineage : downInLineage;
  return grands.filter((g) => firsts.some((f) => ok(f, g)));
}
