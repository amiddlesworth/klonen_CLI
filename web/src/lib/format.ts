import { CURRENT_SEASON } from "./brand";

export type RoleGroup = "head_coach" | "coordinator" | "position_coach" | "ga_analyst" | "support" | "player" | "other";

export const ROLE_GROUP_LABEL: Record<RoleGroup, string> = {
  head_coach: "Head coach",
  coordinator: "Coordinator",
  position_coach: "Position coach",
  ga_analyst: "GA / analyst",
  support: "Support staff",
  player: "Player",
  other: "Other",
};

/** Number of seasons in a span; null when the start is unknown. */
export function seasonCount(start: number | null, end: number | null, isCurrent: boolean): number | null {
  if (!start) return null;
  const last = isCurrent ? CURRENT_SEASON : (end ?? start);
  return Math.max(1, last - start + 1);
}

/**
 * "2019–2022 · 4 seasons", "2024–Present · 3 seasons", "2021 · 1 season".
 * Uses an en dash; callers render it with tabular numerals.
 */
export function seasonRange(start: number | null, end: number | null, isCurrent: boolean): { range: string; count: string | null } {
  if (!start) return { range: YEARS_NOT_IN_SOURCE, count: null };
  const last = isCurrent ? "Present" : String(end ?? start);
  const range = last === String(start) ? String(start) : `${start}–${last}`;
  const n = seasonCount(start, end, isCurrent)!;
  return { range, count: `${n} ${n === 1 ? "season" : "seasons"}` };
}

export function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** @deprecated Use tintFor(): avatars use the six people tints (DESIGN.md §2.3). */
export function hueFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}

export function levelShort(level: string | null | undefined): string | null {
  if (!level) return null;
  return level.replace("NCAA ", "").replace("high school", "High school").replace("pro/semi-pro", "Pro");
}

export function salaryRange(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}K`;
  if (min && max) return `${k(min)}–${k(max)}`;
  return k((min ?? max)!);
}

export function timeAgo(d: Date, now = new Date()): string {
  const s = Math.max(1, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60) || 1}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / (86400 * 7))}w`;
}

/* ---------- DESIGN.md §2.3, §6 additions ---------- */

/** Shown in place of a range when the source gives no start year (DESIGN.md §6.1). */
export const YEARS_NOT_IN_SOURCE = "Years not in source";

export type Tint = 1 | 2 | 3 | 4 | 5 | 6;

/** People tint 1..6: FNV-1a (32-bit) over the person's slug, mod 6, so a person keeps one color everywhere. */
export function tintFor(slug: string): Tint {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ((h % 6) + 1) as Tint;
}

/**
 * Compact range for tree rows, rails and the MoveRecord year column: "2010–19", "2020–", "2003".
 * Pair it with seasonRangeLabel() in aria-label.
 */
export function seasonRangeCompact(start: number | null, end: number | null, isCurrent: boolean): string {
  if (!start) return "–";
  if (isCurrent) return `${start}–`;
  const last = end ?? start;
  if (last === start) return String(start);
  const sameCentury = Math.floor(last / 100) === Math.floor(start / 100);
  return `${start}–${sameCentury ? String(last).slice(2) : last}`;
}

/** Full range and count in one string, for aria-labels and titles: "2010–2019, 10 seasons". */
export function seasonRangeLabel(start: number | null, end: number | null, isCurrent: boolean): string {
  const { range, count } = seasonRange(start, end, isCurrent);
  return count ? `${range}, ${count}` : range;
}

export type StintSpan = { startYear: number | null; endYear: number | null; isCurrent: boolean };

/**
 * Several stints at one program: "2003, 2006–2009" / "5 seasons · 2 stints" (DESIGN.md §6.1).
 * Overlapping or adjacent stints merge into one span; undated stints are ignored.
 */
export function seasonRangeMulti(stints: StintSpan[]): { range: string; count: string | null } {
  const spans = stints
    .filter((s) => s.startYear)
    .map((s) => ({ a: s.startYear!, b: s.isCurrent ? CURRENT_SEASON : (s.endYear ?? s.startYear!), cur: s.isCurrent }))
    .sort((x, y) => x.a - y.a);
  if (!spans.length) return { range: YEARS_NOT_IN_SOURCE, count: null };
  const merged: { a: number; b: number; cur: boolean }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.a <= last.b + 1) {
      last.b = Math.max(last.b, s.b);
      last.cur = last.cur || s.cur;
    } else merged.push({ ...s });
  }
  if (merged.length === 1) {
    const m = merged[0];
    return seasonRange(m.a, m.cur ? null : m.b, m.cur);
  }
  const range = merged.map((m) => (m.cur ? `${m.a}–Present` : m.a === m.b ? String(m.a) : `${m.a}–${m.b}`)).join(", ");
  const n = merged.reduce((sum, m) => sum + (m.b - m.a + 1), 0);
  return { range, count: `${n} ${n === 1 ? "season" : "seasons"} · ${merged.length} stints` };
}

const TITLE_SHORT: [RegExp, string][] = [
  [/\bStrength (?:&|and) Conditioning\b/gi, "S&C"],
  [/\bSpecial Teams Coordinator\b/gi, "ST Coord."],
  [/\bOffensive Coordinator\b/gi, "OC"],
  [/\bDefensive Coordinator\b/gi, "DC"],
  [/\bAssociate\b/gi, "Assoc."],
  [/\bAssistant\b/gi, "Asst."],
  [/\b(Assoc\.|Asst\.) Head Coach\b/gi, "$1 HC"],
  [/\bQuarterbacks\b/gi, "QB"],
  [/\bLinebackers\b/gi, "LB"],
  [/\bDefensive Backs\b/gi, "DBs"],
];

/** Abbreviates titles over 40 characters for compact rows (DESIGN.md §6.3). Shorter titles pass through. */
export function titleShort(title: string, max = 40): string {
  if (title.length <= max) return title;
  let t = title;
  for (const [re, sub] of TITLE_SHORT) t = t.replace(re, sub);
  return t;
}

const ORG_STOP_WORDS = new Set(["of", "the", "at", "and", "&", "in", "-", "–"]);

/**
 * Two or three letters for an organization tile (OrgMark) and the season strip:
 * an acronym short name is kept ("MIT"), otherwise the first letters of the first two
 * significant words ("Lewis & Clark College" -> "LC", "Pacific University" -> "PU").
 */
export function orgInitials(shortName: string, name?: string | null): string {
  const short = shortName.replace(/\(.*?\)/g, "").trim();
  if (/^[A-Z][A-Z&.-]{1,4}$/.test(short)) return short.replace(/[&.-]/g, "").slice(0, 3);
  const words = (name || shortName)
    .replace(/\(.*?\)/g, " ")
    .split(/[\s/-]+/)
    .filter((w) => w && !ORG_STOP_WORDS.has(w.toLowerCase()));
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** "https://www.goboxers.com/sports/..." -> "goboxers.com" (the label of a SourceLink). */
export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Full level name for chip titles: "NCAA D-III" -> "NCAA Division III". */
export function levelFull(level: string | null | undefined): string | null {
  if (!level) return null;
  if (/^high school$/i.test(level)) return "High school";
  if (/^pro/i.test(level)) return "Professional or semi-pro";
  return level.replace(/\bD-(I{1,3})\b/, "Division $1");
}

/** Conference abbreviation for display: drops footnote markers left over from source tables ("NACC[g]" -> "NACC"). */
export function conferenceShort(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  return abbr.replace(/\[[^\]]*\]/g, "").trim() || null;
}

export type AvailabilityAudience = "search_firms" | "selected_programs" | "all_except_current";

/**
 * The private "Open to opportunities" status line (§8.5 MiniProfile, Me menu, settings):
 * "Off · only you see this", or "On · visible to …" naming the audience. Never shown publicly.
 */
export function availabilityStatus(open: boolean, audience: AvailabilityAudience = "all_except_current", currentProgram?: string | null): string {
  if (!open) return "Off · only you see this";
  if (audience === "search_firms") return "On · visible to search firms";
  if (audience === "selected_programs") return "On · visible to programs you chose";
  return `On · visible to employers except ${currentProgram ?? "your program"}`;
}
