/** Small copy helpers for the program page. Ranges and titles go through lib/format.ts. */

/** "1 person" / "12 people". */
export function peopleCount(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

/** "1 open job" / "3 open jobs". */
export function jobsCount(n: number): string {
  return `${n} open ${n === 1 ? "job" : "jobs"}`;
}

/**
 * Tooltip reason for an inferred year (§6.2), quoting the source sentence where we have it:
 * "from the bio: “Joined the staff before the 2026 season…”".
 */
export function evidenceReason(evidence: string | null | undefined, max = 140): string {
  const text = evidence?.trim().replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "");
  if (!text) return "the year is not stated in the bio";
  const clipped = text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;
  return `the bio does not state the year (“${clipped}”)`;
}

/**
 * A title as published, minus a trailing season stamp some staff directories append
 * ("Defensive Line (2025- )" -> "Defensive Line"); the season lives in the ledger instead.
 */
export function displayTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  return title.replace(/\s*\(\s*\d{4}\s*[-–]\s*(?:\d{2,4})?\s*\)\s*$/, "").trim() || title;
}

/**
 * A "title" that is really a class-year or school stamp left by a staff directory ("St. John's '25",
 * "Class of 2019", "2024"), not a role. Those read as nonsense after "Now", so they are dropped.
 */
function isStampTitle(title: string): boolean {
  return /['’‘]\s*\d{2}\s*$/.test(title) || /^(?:class of\s+)?\d{4}$/i.test(title.trim());
}

/** "Now Head Football Coach at Linfield" (or the program alone when the title is missing or not a role). */
export function nowLine(rawTitle: string | null | undefined, orgShortName: string | null | undefined): string | null {
  const shown = displayTitle(rawTitle);
  const title = shown && !isStampTitle(shown) ? shown : null;
  if (title && orgShortName) return `Now ${title} at ${orgShortName}`;
  if (orgShortName) return `Now at ${orgShortName}`;
  if (title) return `Now ${title}`;
  return null;
}
