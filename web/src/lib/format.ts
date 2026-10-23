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
  if (!start) return { range: isCurrent ? "Present" : "Dates not listed", count: null };
  const last = isCurrent ? "Present" : String(end ?? start);
  const range = last === String(start) ? String(start) : `${start}–${last}`;
  const n = seasonCount(start, end, isCurrent)!;
  return { range, count: `${n} ${n === 1 ? "season" : "seasons"}` };
}

export function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Stable hue (0-359) per name, for avatar tints. */
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
