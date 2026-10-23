import { titleShort } from "@/lib/format";

/** Text helpers for pipeline cards. Plain module: safe in server and client code. */

const NBSP = "\u00A0";

/**
 * A program name that never breaks inside itself: hyphens become non-breaking (U+2011), and a
 * name of `max` characters or fewer (24 by default) also gets non-breaking spaces, so lines never
 * start with "& Lee" or "(WI)". Longer names may still wrap at a space.
 */
export function keepTogether(name: string, max = 24): string {
  const t = name.replace(/-/g, "\u2011");
  return t.length <= max ? t.replace(/ /g, NBSP) : t;
}

/**
 * "{before} at {program}" for card lines. A one-word program keeps "at" with it ("at Kalamazoo"),
 * so it never sits alone on the last line; a longer program (already one unit) leaves "at" free to
 * end the line before it ("Assistant at / Franklin & Marshall"). `max` as in keepTogether.
 */
export function atProgram(before: string, program: string, max = 24): string {
  const name = keepTogether(program, max);
  return /[\s\u00A0]/.test(name) ? `${before} at ${name}` : `${before} at${NBSP}${name}`;
}

/**
 * The longest program kept in one piece on a context line that ends in years: the program, the
 * comma and the years (", 2020–22", bound to it with a no-break space) must fit the narrowest card
 * line (about 30 characters at 1081px). Longer programs wrap at a space instead.
 */
export function programBudget(years: string | null): number {
  return years ? Math.min(24, 30 - years.length - 2) : 24;
}

/** Position groups shortened in context lines, after the §6.3 titleShort() set (QB, LB, DBs). */
const CONTEXT_TITLE: [RegExp, string][] = [
  [/\bGraduate Assistant(?: Coach)?\b/gi, "GA"],
  [/\bWide Receivers?\b/gi, "WR"],
  [/\bTight Ends?\b/gi, "TE"],
  [/\bRunning Backs?\b/gi, "RB"],
  [/\bOffensive Line\b/gi, "OL"],
  [/\bDefensive Line\b/gi, "DL"],
];

/** A role that stands on its own, so "{role} and {other role}" can be cut after it. */
const COMPLETE_ROLE = /\b(Coach|Coord\.|Coordinator|Analyst|Assistant|Asst\.|GA|Director|Manager|Intern)$/i;

/**
 * A past title for a one- or two-line context ("Previously {title} at {program}"): every §6.3
 * titleShort() abbreviation regardless of length, "Graduate Assistant" as GA (the word the quick
 * searches use) and the position groups as WR, TE, RB, OL, DL; a combined title longer than 28
 * characters keeps its first role ("Defensive Secondary Coach / Recruiting Coordinator",
 * "DL Coach and Defensive Recruiting Coordinator"). The card keeps the full title for screen
 * readers and hover.
 */
export function contextTitle(role: string): string {
  let t = role;
  for (const [re, sub] of CONTEXT_TITLE) t = t.replace(re, sub);
  t = titleShort(t, 0);
  if (t.length <= 28) return t;
  const [first] = t.split(/\s*\/\s*|\s+[-–—]\s+/);
  if (first && first.length < t.length) return first.trim();
  const joined = t.match(/^(.+?)\s+(?:and|&)\s+/i);
  return joined && COMPLETE_ROLE.test(joined[1]) ? joined[1] : t;
}

/**
 * "Previously GA (Defense) at Mount St. Joseph". A sentence past 46 characters also drops the unit
 * in parentheses ("Previously GA at Fairleigh Dickinson‑Florham"), so it stays within two lines on
 * the narrowest four-column board; the card keeps the full title for screen readers and hover.
 */
export function previouslyAt(role: string, program: string, years: string | null): string {
  let title = contextTitle(role);
  if (`Previously ${title} at ${program}`.length > 46) title = title.replace(/\s*\([^)]*\)/g, "").trim() || title;
  return atProgram(`Previously ${title}`, program, programBudget(years));
}

/** "Ian Falconer's", "Jeff Thomas'" (the same rule as the search feature's tree lines). */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
