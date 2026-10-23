/*
 * Feed copy helpers (DESIGN.md §6.3). Pure functions, safe on server and client. Feed sentences use
 * AP style: lowercase titles joined with "and" and commas, never "/". Record rows use sentence case
 * with commas. Pronouns never appear: we repeat the first name or use neutral phrasing.
 */

/** Drops leftovers from source tables: "Head Coach (2025- )" -> "Head Coach"; "OC | OL" -> "OC / OL". */
export function cleanTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .replace(/\s*\(\s*\d{4}\s*[-–]\s*(?:\d{2,4})?\s*\)\s*$/, "")
    .replace(/\s*\|\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercases a title word unless it is an acronym ("QB", "S&C", "NFL") or has inner capitals ("McKay"). */
function lowerWord(w: string): string {
  if (/^[A-Z0-9&.'’-]{2,}$/.test(w)) return w;
  if (/^[A-Z][a-z]+[A-Z]/.test(w)) return w;
  return w.toLowerCase();
}

function lowerTitle(part: string): string {
  return part
    .replace(/\s+[-–—]\s+/g, ", ")
    .replace(/\s*&\s*/g, " and ")
    .split(" ")
    .map(lowerWord)
    .join(" ");
}

/** The slash- and comma-separated parts of a title, lowercased. */
function titleParts(title: string): string[] {
  return cleanTitle(title)
    .split(/\s*[/,;]\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(lowerTitle);
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** AP title for feed sentences: "Offensive Coordinator / Quarterbacks" -> "offensive coordinator and quarterbacks". */
export function apTitle(title: string): string {
  return joinAnd(titleParts(title)) || "staff member";
}

/** Sentence-case title for record rows: "Offensive Coordinator / Quarterbacks" -> "Offensive coordinator, quarterbacks". */
export function recordTitle(title: string): string {
  const s = titleParts(title).join(", ");
  return s ? s[0].toUpperCase() + s.slice(1) : "Staff member";
}

/** First name for labels ("Coached under Ian"). */
export function firstNameOf(fullName: string, firstName?: string | null): string {
  return firstName?.trim() || fullName.trim().split(/\s+/)[0] || fullName;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** AP numbers: one through nine spelled out, 10 and up as figures. */
export function apNumber(n: number): string {
  return n >= 0 && n < 10 ? NUMBER_WORDS[n] : String(n);
}

/** "Portland State University" -> "Portland State" (a school's short label in context lines). */
export function schoolShort(name: string): string {
  return name
    .replace(/^(The )?University of /i, "")
    .replace(/\s+(University|College)$/i, "")
    .trim();
}

/** Normalized school name for comparing alma maters. */
export function schoolKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const k = schoolShort(name).toLowerCase().replace(/[^a-z]/g, "");
  return k || null;
}

/** True when a verbatim quote can be shown under the copy rule: no gendered pronouns. */
export function isNeutralQuote(text: string): boolean {
  return !/\b(he|him|his|himself|she|her|hers|herself)\b/i.test(text);
}

/** Position keys of a title for "Matches your position group": "Special Teams Coordinator / DBs" -> ["special teams", ...]. */
export function positionKeys(title: string | null | undefined): string[] {
  if (!title) return [];
  return cleanTitle(title)
    .toLowerCase()
    .split(/\s*[/,&|]\s*|\s+and\s+/)
    .map((p) =>
      p
        .replace(/\b(assistant|associate|asst\.?|assoc\.?|co-|senior|graduate|coach(es)?|coordinator|coord\.?|director|of|the|position|intern)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((p) => p.length > 2 && !/^(head|football|defensive|offensive|recruiting|operations)$/.test(p));
}
