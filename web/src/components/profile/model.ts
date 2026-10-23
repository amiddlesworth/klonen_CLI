/*
 * Pure view-model helpers for the coach profile (DESIGN.md §8.4). No data access: they shape the
 * rows that getProfile / getTree return into the ledger, ranges and tree groups the cards render.
 */
import type { OrgSummary, TenureRow, Tree, TreeLink } from "@/lib/queries/people";
import { CURRENT_SEASON } from "@/lib/brand";
import { ROLE_GROUP_LABEL, YEARS_NOT_IN_SOURCE, seasonRange, seasonRangeMulti, type RoleGroup } from "@/lib/format";

export type Span = { startYear: number | null; endYear: number | null; isCurrent: boolean };

/** A ledger range: the range line, the count line under it, and whether there is no year at all. */
export type RangeText = { range: string; count: string | null; undated: boolean };

const fullyDated = (s: Span) => !!s.startYear && (s.isCurrent || !!s.endYear);

/**
 * One stint's range (§6.1 via seasonRange), plus the partial cases the data has: a current role with
 * no start year, a start with no end, an end with no start. The missing piece is said in words.
 */
export function spanText(s: Span): RangeText {
  if (fullyDated(s)) return { ...seasonRange(s.startYear, s.endYear, s.isCurrent), undated: false };
  if (s.startYear) return { range: `From ${s.startYear}`, count: "End year not in source", undated: false };
  if (s.isCurrent) return { range: "Current", count: "Start year not in source", undated: false };
  if (s.endYear) return { range: `Through ${s.endYear}`, count: "Start year not in source", undated: false };
  return { range: YEARS_NOT_IN_SOURCE, count: null, undated: true };
}

/** A program's total range across its roles: seasonRangeMulti when every role is dated. */
export function groupText(spans: Span[]): RangeText {
  if (spans.length === 1) return spanText(spans[0]);
  if (spans.every(fullyDated)) return { ...seasonRangeMulti(spans), undated: false };
  const starts = spans.map((s) => s.startYear).filter((y): y is number => !!y);
  const isCurrent = spans.some((s) => s.isCurrent);
  const ends = spans.map((s) => s.endYear ?? s.startYear).filter((y): y is number => !!y);
  if (!starts.length) return spanText({ startYear: null, endYear: ends.length ? Math.max(...ends) : null, isCurrent });
  const start = Math.min(...starts);
  const end = isCurrent ? null : Math.max(start, ...ends);
  const base = spanText({ startYear: start, endYear: end, isCurrent });
  return { range: base.range, count: "Some years not in source", undated: false };
}

/** Plain-words reason for an inferred year, quoting the evidence (§6.2). */
export function inferredReason(evidence: string | null): string {
  if (!evidence) return "from the staff bio, not stated in it";
  const q = evidence.trim().replace(/^["“]|["”]$/g, "");
  const short = q.length > 160 ? `${q.slice(0, 157).trimEnd()}…` : q;
  return `from the staff bio, which says “${short}”`;
}

/** Seasons covered by dated coaching stints (the season strip counts the same seasons). */
export function coachingSeasons(rows: TenureRow[]): number[] {
  const years = new Set<number>();
  for (const r of rows) {
    if (r.asPlayer || r.roleGroup === "player" || !r.startYear) continue;
    const last = r.isCurrent ? CURRENT_SEASON : (r.endYear ?? r.startYear);
    for (let y = r.startYear; y <= Math.max(r.startYear, last); y++) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}

/** The first dated coaching season and whether its year is inferred. */
export function firstSeason(rows: TenureRow[]): { year: number; inferred: boolean; reason: string } | null {
  let best: TenureRow | null = null;
  for (const r of rows) {
    if (r.asPlayer || r.roleGroup === "player" || !r.startYear) continue;
    if (!best || r.startYear < best.startYear! || (r.startYear === best.startYear && r.yearsExplicit)) best = r;
  }
  return best ? { year: best.startYear!, inferred: !best.yearsExplicit, reason: inferredReason(best.evidence) } : null;
}

const UNIT_LABEL: Record<string, string> = { offense: "Offense", defense: "Defense", special_teams: "Special teams" };

/** The level line under a role title: "Coordinator · Special teams". */
export function levelLine(r: Pick<TenureRow, "roleGroup" | "unit">): string {
  const level = ROLE_GROUP_LABEL[r.roleGroup as RoleGroup] ?? "Coach";
  const unit = r.unit ? UNIT_LABEL[r.unit] : null;
  return unit && r.roleGroup !== "head_coach" ? `${level} · ${unit}` : level;
}

export type LedgerItem =
  | { kind: "role"; role: TenureRow; range: RangeText; inferred: boolean; reason: string; awayAfter: boolean }
  | { kind: "away"; text: string };

export type LedgerGroup = {
  org: OrgSummary;
  items: LedgerItem[];
  roleCount: number;
  range: RangeText;
  inferred: boolean;
  reason: string;
  isCurrent: boolean;
};

const yearSpan = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);
const endOf = (r: TenureRow) => (r.isCurrent ? CURRENT_SEASON : (r.endYear ?? r.startYear));

/**
 * Experience ledger (§8.4): one group per program, in the source's order (newest first), with every
 * stint at that program inside it, even when another program came in between ("Away 2004–2005 ·
 * Oberlin College" on a dashed rail).
 */
export function buildLedger(rows: TenureRow[]): LedgerGroup[] {
  const coaching = rows.filter((r) => !r.asPlayer && r.roleGroup !== "player");
  const order: string[] = [];
  const byOrg = new Map<string, TenureRow[]>();
  for (const r of coaching) {
    if (!byOrg.has(r.org.id)) {
      byOrg.set(r.org.id, []);
      order.push(r.org.id);
    }
    byOrg.get(r.org.id)!.push(r);
  }
  return order.map((orgId) => {
    const roles = byOrg.get(orgId)!;
    const items: LedgerItem[] = [];
    roles.forEach((role, i) => {
      const item: LedgerItem = {
        kind: "role",
        role,
        range: spanText(role),
        inferred: !role.yearsExplicit && (!!role.startYear || !!role.endYear),
        reason: inferredReason(role.evidence),
        awayAfter: false,
      };
      items.push(item);
      const older = roles[i + 1];
      if (!older || !role.startYear || !older.startYear) return;
      const olderEnd = endOf(older)!;
      if (role.startYear <= olderEnd + 1) return;
      const from = olderEnd + 1;
      const to = role.startYear - 1;
      const elsewhere = [
        ...new Set(
          coaching
            .filter((r) => r.org.id !== orgId && r.startYear && r.startYear <= to && (endOf(r) ?? r.startYear) >= from)
            .map((r) => r.org.name),
        ),
      ];
      item.awayAfter = true;
      const where = elsewhere.length > 2 ? `${elsewhere.slice(0, 2).join(", ")} and others` : elsewhere.join(" and ");
      items.push({ kind: "away", text: where ? `Away ${yearSpan(from, to)} · ${where}` : `Away ${yearSpan(from, to)}` });
    });
    const head = roles.length === 1 ? roles[0] : roles.reduce((a, b) => ((b.startYear ?? 9999) < (a.startYear ?? 9999) ? b : a));
    const range = groupText(roles);
    return {
      org: roles[0].org,
      items,
      roleCount: roles.length,
      range,
      inferred: !range.undated && !head.yearsExplicit && (!!head.startYear || !!head.endYear),
      reason: inferredReason(head.evidence),
      isCurrent: roles.some((r) => r.isCurrent),
    };
  });
}

export type TreeGroupKey = "mentors" | "peers" | "mentees";

export type TreeRowModel = TreeLink & { context: string | null };

export type TreeModel = {
  groups: { key: TreeGroupKey; label: string; rows: TreeRowModel[] }[];
  /** Unique people across the three groups. */
  unique: number;
  /** Footnote: who appears in two groups and why, then how the tree is derived. */
  footnote: string;
};

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Coaching tree card (§8.4): Worked under · Worked alongside · Coached under {first}, the unique
 * count, and a footnote naming anyone listed twice. Empty groups are left out.
 */
export function buildTree(tree: Tree, firstName: string, currentOrgSlug: string | null): TreeModel {
  const menteeById = new Map(tree.mentees.map((l) => [l.person.id, l]));
  const at = (l: TreeLink) => (currentOrgSlug && l.org.slug === currentOrgSlug ? null : `At ${l.org.shortName}`);
  const groups: TreeModel["groups"] = [
    { key: "mentors" as const, label: "Worked under", rows: tree.mentors.map((l) => ({ ...l, context: at(l) })) },
    {
      key: "peers" as const,
      label: "Worked alongside",
      rows: tree.peers.map((l) => {
        const m = menteeById.get(l.person.id);
        return { ...l, context: m?.startYear ? `Joined ${firstName}'s staff in ${m.startYear}` : at(l) };
      }),
    },
    { key: "mentees" as const, label: `Coached under ${firstName}`, rows: tree.mentees.map((l) => ({ ...l, context: at(l) })) },
  ].filter((g) => g.rows.length > 0);

  const seen = new Map<string, TreeGroupKey[]>();
  for (const g of groups) for (const r of g.rows) seen.set(r.person.id, [...(seen.get(r.person.id) ?? []), g.key]);
  const unique = seen.size;
  const twice = [...seen.entries()].filter(([, keys]) => keys.length > 1);
  const nameOf = (id: string) => [...tree.mentors, ...tree.peers, ...tree.mentees].find((l) => l.person.id === id)!.person.fullName;
  const people = `${unique} ${unique === 1 ? "person" : "people"}`;
  const derived = "Derived from overlapping seasons on the same staff.";
  if (!twice.length) return { groups, unique, footnote: `${people}, derived from overlapping seasons on the same staff.` };

  const beforeJoining = twice.every(([id, keys]) => {
    if (!keys.includes("peers") || !keys.includes("mentees")) return false;
    const peer = tree.peers.find((l) => l.person.id === id);
    const mentee = menteeById.get(id);
    return !!peer?.endYear && !!mentee?.startYear && peer.endYear <= mentee.startYear;
  });
  const names = twice.map(([id]) => nameOf(id));
  let why: string;
  if (twice.length === 1) {
    const first = names[0].split(" ")[0];
    why = beforeJoining
      ? `${names[0]} is listed twice because ${first} worked alongside ${firstName} before joining ${firstName}'s staff.`
      : `${names[0]} is listed in two groups because the roles changed over the years.`;
  } else {
    why = beforeJoining
      ? `${listNames(names)} are listed twice because they worked alongside ${firstName} before joining ${firstName}'s staff.`
      : `${listNames(names)} are listed in two groups because their roles changed over the years.`;
  }
  return { groups, unique, footnote: `${people}. ${why} ${derived}` };
}

/** The full state name for a two-letter abbreviation ("OR" → "Oregon"); other values pass through. */
export function stateName(abbr: string | null | undefined): string | null {
  if (!abbr) return null;
  return STATES[abbr.toUpperCase()] ?? abbr;
}

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
