/**
 * Date labels for messages and notifications (real timestamps, so clock times and relative days are
 * allowed, DESIGN.md §6.3). Pure functions, safe on the server and the client. `timeZone` undefined
 * means the runtime's zone; client components pass "UTC" until mounted so the first render matches
 * the server's.
 */

export function threadHref(threadId: string): string {
  return `/messaging?thread=${encodeURIComponent(threadId)}`;
}

/** "2026-10-23" in the given zone, for comparing calendar days. */
export function dayKey(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "Today", "Yesterday", "Wednesday, October 14", or "October 14, 2025" in an earlier year. */
export function dayLabel(d: Date, now: Date, timeZone?: string): string {
  const key = dayKey(d, timeZone);
  if (key === dayKey(now, timeZone)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return "Yesterday";
  const sameYear = key.slice(0, 4) === dayKey(now, timeZone).slice(0, 4);
  return new Intl.DateTimeFormat("en-US", sameYear ? { timeZone, weekday: "long", month: "long", day: "numeric" } : { timeZone, month: "long", day: "numeric", year: "numeric" }).format(d);
}

/** "7:42 AM". */
export function clockTime(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(d);
}

/** "Friday, October 23, 2026, 7:42 AM" for tooltips. */
export function fullDateTime(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "full", timeStyle: "short" }).format(d);
}

/** "a", "a and b", "a, b and c". */
export function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * The tooltip reason for an inferred season (§6.2), after "Inferred: ". Quotes the staff-bio sentence
 * only when it has no gendered pronouns (gender is not in the data, so we never repeat one).
 */
export function inferredSeasonReason(evidence: string | null, sourceUrl: string | null): string {
  let bio = "the staff bio";
  if (sourceUrl) {
    try {
      bio = `the ${new URL(sourceUrl).hostname.replace(/^www\./, "")} staff bio`;
    } catch {
      // Not a URL: keep the generic wording.
    }
  }
  const q = evidence?.trim().replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "");
  if (q && !/\b(he|him|his|himself|she|her|hers|herself)\b/i.test(q)) {
    return `from ${bio}, which says “${q.length > 140 ? `${q.slice(0, 137).trimEnd()}…` : q}”`;
  }
  return `the season is worked out from ${bio}, which doesn't state the year`;
}
