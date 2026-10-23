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
