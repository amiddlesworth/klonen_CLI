/*
 * Pure view-model helpers for the coach profile (DESIGN.md §8.4). No data access: they shape the
 * rows that getProfile / getTree return into the ledger, ranges and tree groups the cards render.
 */
import type { StripStint } from "@/components/data/SeasonStrip";
import type { OrgSummary, TenureRow, Tree, TreeLink } from "@/lib/queries/people";
import { CURRENT_SEASON } from "@/lib/brand";
import { ROLE_GROUP_LABEL, YEARS_NOT_IN_SOURCE, seasonRange, seasonRangeMulti, type RoleGroup } from "@/lib/format";
import { linkYearsDisplay, type LinkYears } from "./linkYears";

export type Span = { startYear: number | null; endYear: number | null; isCurrent: boolean };

/**
 * A stint as the profile reads it: the tenure row plus its sport (getProfileCached adds it). Callers that
 * don't pass a sport get the old behavior: the row counts as football.
 */
export type SportRow = TenureRow & { sport?: string | null };

/** Football (the sport this network covers), or a row whose sport the caller didn't load. */
export const isFootball = (r: Pick<SportRow, "sport">) => !r.sport || r.sport === "football";

/**
 * The one test for "football coaching" behind every coaching number on the profile (seasons coached,
 * first season, coaching stops, the season strip): a football stint that isn't a playing stint. Football
 * rows with role group "other" stay in (most are unclassified titles such as "Coach"). Roles in other
 * sports ("Head Coach" of women's basketball) are listed in Experience under their sport but never
 * counted, matching the coaching tree (linkYears edgeEligible counts football only).
 */
export const isFootballCoaching = (r: Pick<SportRow, "asPlayer" | "roleGroup" | "sport">) => !r.asPlayer && r.roleGroup !== "player" && isFootball(r);

/** "women's basketball" → "Women's basketball" (the sport as the source names it, sentence case). */
export function sportLabel(sport: string): string {
  const s = sport.trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * A ledger range: the range line, the count line under it, and whether there is no year at all.
 * `lead` is a word before the year on a partial range ("From ", "Through "): only the year after it
 * carries the inferred mark. `noYear` marks a range line with no year in it ("Current").
 */
export type RangeText = { range: string; count: string | null; undated: boolean; lead?: string; noYear?: boolean };

const fullyDated = (s: Span) => !!s.startYear && (s.isCurrent || !!s.endYear);

/**
 * One stint's range (§6.1 via seasonRange), plus the partial cases the data has: a current role with
 * no start year, a start with no end, an end with no start. The missing piece is said in words.
 */
export function spanText(s: Span): RangeText {
  if (fullyDated(s)) return { ...seasonRange(s.startYear, s.endYear, s.isCurrent), undated: false };
  if (s.startYear) return { lead: "From ", range: String(s.startYear), count: "End year not in source", undated: false };
  if (s.isCurrent) return { range: "Current", count: "Start year not in source", undated: false, noYear: true };
  if (s.endYear) return { lead: "Through ", range: String(s.endYear), count: "Start year not in source", undated: false };
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
  return { ...base, count: "Some years not in source" };
}

/** "Ian Falconer's", "Jesse Browning's", "Chris Jones'". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/**
 * Plain-words reason for an inferred year, quoting the evidence (§6.2). `whose` names the person whose
 * bio it is when that isn't the profile's own (tree rows, where the year can come from either side).
 */
export function inferredReason(evidence: string | null, whose?: string): string {
  const bio = whose ? `${possessive(whose)} staff bio` : "the staff bio";
  if (!evidence) return `from ${bio}, not stated in it`;
  const q = evidence.trim().replace(/^["“]|["”]$/g, "");
  const short = q.length > 160 ? `${q.slice(0, 157).trimEnd()}…` : q;
  return `from ${bio}, which says “${short}”`;
}

/** Seasons covered by dated football coaching stints (the season strip counts the same seasons). */
export function coachingSeasons(rows: SportRow[]): number[] {
  const years = new Set<number>();
  for (const r of rows) {
    if (!isFootballCoaching(r) || !r.startYear) continue;
    const last = r.isCurrent ? CURRENT_SEASON : (r.endYear ?? r.startYear);
    for (let y = r.startYear; y <= Math.max(r.startYear, last); y++) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}

/** The first dated football coaching season and whether its year is inferred. */
export function firstSeason(rows: SportRow[]): { year: number; inferred: boolean; reason: string } | null {
  let best: SportRow | null = null;
  for (const r of rows) {
    if (!isFootballCoaching(r) || !r.startYear) continue;
    if (!best || r.startYear < best.startYear! || (r.startYear === best.startYear && r.yearsExplicit)) best = r;
  }
  return best ? { year: best.startYear!, inferred: !best.yearsExplicit, reason: inferredReason(best.evidence) } : null;
}

/** Coaching stops: programs where the person held a football coaching role (the header stat). */
export function coachingStops(rows: SportRow[]): number {
  return new Set(rows.filter(isFootballCoaching).map((r) => r.org.id)).size;
}

/** Roles in other sports: listed in Experience, left out of every coaching number (the card says so). */
export function otherSportRoleCount(rows: SportRow[]): number {
  return rows.filter((r) => !r.asPlayer && r.roleGroup !== "player" && !isFootball(r)).length;
}

/** The season strip's input: football coaching stints only, so the figure counts what the header counts. */
export function stripStints(rows: SportRow[]): StripStint[] {
  return rows.filter(isFootballCoaching).map((r) => ({
    orgId: r.org.id,
    shortName: r.org.shortName,
    name: r.org.name,
    role: r.role,
    roleGroup: r.roleGroup,
    startYear: r.startYear,
    endYear: r.endYear,
    isCurrent: r.isCurrent,
  }));
}

const UNIT_LABEL: Record<string, string> = { offense: "Offense", defense: "Defense", special_teams: "Special teams" };

/** The level words a title in another sport implies ("Head Track and Field Coach" → "Head coach"). */
function otherSportLevel(role: string): string | null {
  if (/\bhead\b.*\bcoach\b|\bhead coach\b/i.test(role)) return "Head coach";
  if (/\b(assistant|asst\.?|associate|assoc\.?)\b/i.test(role) && /\bcoach/i.test(role)) return "Assistant coach";
  if (/\bcoach/i.test(role)) return "Coach";
  return null;
}

/**
 * The level line under a role title: "Coordinator · Special teams". A role in another sport names the
 * sport first ("Women's basketball · Head coach"), so it never reads as football; a football role the
 * source doesn't classify says so instead of a bare "Other".
 */
export function levelLine(r: Pick<SportRow, "roleGroup" | "unit" | "role" | "sport">): string {
  if (!isFootball(r)) {
    const level = otherSportLevel(r.role ?? "");
    return [sportLabel(r.sport!), level].filter(Boolean).join(" · ");
  }
  if (r.roleGroup === "other") return "Level not in source";
  const level = ROLE_GROUP_LABEL[r.roleGroup as RoleGroup] ?? "Coach";
  const unit = r.unit ? UNIT_LABEL[r.unit] : null;
  return unit && r.roleGroup !== "head_coach" ? `${level} · ${unit}` : level;
}

/** A playing stint's line: the role as published, after the sport when it isn't football ("Baseball · Player (catcher)"). */
export function playingLine(r: Pick<SportRow, "role" | "sport">): string {
  return isFootball(r) ? r.role : `${sportLabel(r.sport!)} · ${r.role}`;
}

export type LedgerItem =
  | { kind: "role"; role: SportRow; range: RangeText; inferred: boolean; reason: string; awayAfter: boolean }
  | { kind: "away"; text: string };

export type LedgerGroup = {
  org: OrgSummary;
  items: LedgerItem[];
  roleCount: number;
  range: RangeText;
  inferred: boolean;
  reason: string;
  isCurrent: boolean;
  /** Some role here has a year (or is current), so the group has a place in the newest-first order. */
  dated: boolean;
};

const yearSpan = (a: number, b: number) => (a === b ? String(a) : `${a}–${b}`);
const endOf = (r: SportRow) => (r.isCurrent ? CURRENT_SEASON : (r.endYear ?? r.startYear));

/**
 * Experience ledger (§8.4): one group per program, in the source's order (newest first), with every
 * stint at that program inside it, even when another program came in between ("Away 2004–2005 ·
 * Oberlin College" on a dashed rail). Programs with no year at all come last (`dated: false`): the source
 * gives them no place in the order, so the card lists them under their own label.
 */
export function buildLedger(rows: SportRow[]): LedgerGroup[] {
  const coaching = rows.filter((r) => !r.asPlayer && r.roleGroup !== "player");
  const order: string[] = [];
  const byOrg = new Map<string, SportRow[]>();
  for (const r of coaching) {
    if (!byOrg.has(r.org.id)) {
      byOrg.set(r.org.id, []);
      order.push(r.org.id);
    }
    byOrg.get(r.org.id)!.push(r);
  }
  const groups = order.map((orgId): LedgerGroup => {
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
      dated: roles.some((r) => r.isCurrent || !!r.startYear || !!r.endYear),
    };
  });
  return [...groups.filter((g) => g.dated), ...groups.filter((g) => !g.dated)];
}

/**
 * The header's current role: the person's current title (the staff directory's words, which the Me menu,
 * the feed and other people's tree rows also use, so a coach reads the same everywhere), else the role of
 * the current coaching stint at the current program. The Experience row keeps the bio's own wording, and
 * its Source shows where that wording comes from.
 */
export function currentHeadline(rows: SportRow[], currentOrgId: string | null, directoryTitle: string | null): string | null {
  if (directoryTitle?.trim()) return directoryTitle.trim();
  const current = rows.filter((r) => r.isCurrent && isFootballCoaching(r));
  const here = current.find((r) => !currentOrgId || r.org.id === currentOrgId);
  return here?.role || null;
}

/** Football coaching roles whose seasons aren't counted because the source gives no start year. */
export function undatedRoleCount(rows: SportRow[]): number {
  return rows.filter((r) => isFootballCoaching(r) && !r.startYear).length;
}

export type TreeGroupKey = "mentors" | "peers" | "mentees";

/**
 * How a link's shared seasons read in a compact row (linkYears): a range, "Current", or nothing. A range
 * marks each bound on its own (`startInferred`, `endInferred`), so only the inferred year is dotted;
 * `inferred` is either one.
 */
export type TreeYearsView =
  | {
      kind: "range";
      startYear: number;
      endYear: number | null;
      ongoing: boolean;
      inferred: boolean;
      reason: string | null;
      startInferred: boolean;
      endInferred: boolean;
      startReason: string | null;
      endReason: string | null;
    }
  | { kind: "current" }
  | { kind: "none" };

/** The view of a link's years. `nameOf` names whose bio an inferred year comes from. */
export function treeYearsView(years: LinkYears | undefined, nameOf: (personId: string) => string | undefined): TreeYearsView {
  if (!years) return { kind: "none" };
  const display = linkYearsDisplay(years);
  if (display === "current") return { kind: "current" };
  if (display === "none" || !years.startYear) return { kind: "none" };
  const endYear = years.ongoing ? null : years.endYear;
  // Links built without per-bound status read as before: the mark on the start year.
  const startInferred = years.startInferred ?? years.inferred;
  const endInferred = !!endYear && (years.endInferred ?? false);
  const why = (from: LinkYears["inferredFrom"] | undefined) => (from ? inferredReason(from.evidence, nameOf(from.personId)) : null);
  const startReason = startInferred ? why(years.startFrom ?? years.inferredFrom) : null;
  const endReason = endInferred ? why(years.endFrom ?? years.inferredFrom) : null;
  return {
    kind: "range",
    startYear: years.startYear,
    endYear,
    ongoing: years.ongoing,
    inferred: startInferred || endInferred,
    reason: startReason ?? endReason,
    startInferred,
    endInferred,
    startReason,
    endReason,
  };
}

/** What byTenure reads from a tree link. */
type TenureOrdered = { years: LinkYears; person: { fullName: string } };

/**
 * Order inside a tree group, current staff first (a head coach or AD scanning the card wants them before
 * people who have left):
 *  1. ongoing links with a start year, longest-serving first;
 *  2. ongoing links whose start the source doesn't give ("Current"), by name;
 *  3. past links with a range, most recent end first, then longest-serving;
 *  4. links whose years the source doesn't pin, by name.
 */
export function byTenure(a: TenureOrdered, b: TenureOrdered): number {
  const rank = (l: TenureOrdered) => {
    const display = linkYearsDisplay(l.years);
    if (l.years.ongoing) return display === "range" ? 0 : 1;
    return display === "range" ? 2 : 3;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) {
    const s = (a.years.startYear ?? 0) - (b.years.startYear ?? 0);
    if (s) return s;
  } else if (ra === 2) {
    const e = (b.years.endYear ?? 0) - (a.years.endYear ?? 0);
    if (e) return e;
    const s = (a.years.startYear ?? 0) - (b.years.startYear ?? 0);
    if (s) return s;
  }
  return a.person.fullName.localeCompare(b.person.fullName);
}

/**
 * The context line under a tree row (§8.3 ContextLine): a player relationship ("Played for Ian 2024–25"),
 * when a peer later joined the coach's staff ("Joined Ian's staff in 2020"), or the program when it isn't
 * the coach's current one ("At Oberlin").
 */
export type TreeContext =
  | { kind: "player"; text: string; years: TreeYearsView }
  | { kind: "joined"; text: string; year: { value: number; inferred: boolean; reason: string | null } }
  | { kind: "at"; text: string };

/** A tree link as getProfileTree returns it: its years and any player relationship, checked against the stints. */
type AnnotatedLink = TreeLink & { years?: LinkYears; player?: { kind: "played_for" | "coached"; years: LinkYears } | null };

export type TreeRowModel = TreeLink & { range: TreeYearsView; context: TreeContext | null };

export type TreeModel = {
  groups: { key: TreeGroupKey; label: string; rows: TreeRowModel[] }[];
  /** Unique people across the three groups. */
  unique: number;
  /** Footnote: who appears in two groups and why, then how the tree is derived. */
  footnote: string;
  /** Some year shown in the card is inferred (the page explains the dotted mark once). */
  inferred: boolean;
};

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Coaching tree card (§8.4): Worked under · Worked alongside · Coached under {first}, the unique
 * count, and a footnote naming anyone listed twice. Empty groups are left out. Years come only from
 * getProfileTree's checked `years`: a link without them shows no range (never a filled-in season).
 * `self` is the profile's person (to name whose bio an inferred year comes from).
 */
export function buildTree(tree: Tree | { mentors: AnnotatedLink[]; peers: AnnotatedLink[]; mentees: AnnotatedLink[] }, firstName: string, currentOrgSlug: string | null, self?: { id: string; fullName: string }): TreeModel {
  const mentees = tree.mentees as AnnotatedLink[];
  const menteeById = new Map(mentees.map((l) => [l.person.id, l]));
  const all = [...tree.mentors, ...tree.peers, ...tree.mentees] as AnnotatedLink[];
  const nameFor = (l: AnnotatedLink) => (id: string) => (id === l.person.id ? l.person.fullName : id === self?.id ? self.fullName : undefined);

  const context = (l: AnnotatedLink, bucket: TreeGroupKey): TreeContext | null => {
    const names = nameFor(l);
    if (l.player) {
      const years = treeYearsView(l.player.years, names);
      return {
        kind: "player",
        text: l.player.kind === "played_for" ? `Played for ${firstName}` : `Coached ${firstName} as a player`,
        // A run with an unknown bound reads without years ("Played for Ian"), never "Current".
        years: years.kind === "range" ? years : { kind: "none" },
      };
    }
    if (bucket === "peers") {
      const joined = menteeById.get(l.person.id);
      const start = joined?.years?.startYear;
      if (joined?.years && start) {
        // The year shown is the start of the mentee run: only the start bound's status counts.
        const inferred = joined.years.startInferred ?? joined.years.inferred;
        const from = joined.years.startFrom ?? joined.years.inferredFrom;
        const reason = inferred && from ? inferredReason(from.evidence, nameFor(joined)(from.personId)) : null;
        return { kind: "joined", text: `Joined ${firstName}'s staff in`, year: { value: start, inferred, reason } };
      }
    }
    return currentOrgSlug && l.org.slug === currentOrgSlug ? null : { kind: "at", text: `At ${l.org.shortName}` };
  };
  const row = (l: AnnotatedLink, bucket: TreeGroupKey): TreeRowModel => ({ ...l, range: treeYearsView(l.years, nameFor(l)), context: context(l, bucket) });

  const groups: TreeModel["groups"] = [
    { key: "mentors" as const, label: "Worked under", rows: (tree.mentors as AnnotatedLink[]).map((l) => row(l, "mentors")) },
    { key: "peers" as const, label: "Worked alongside", rows: (tree.peers as AnnotatedLink[]).map((l) => row(l, "peers")) },
    { key: "mentees" as const, label: `Coached under ${firstName}`, rows: mentees.map((l) => row(l, "mentees")) },
  ].filter((g) => g.rows.length > 0);

  const inferred = groups.some((g) =>
    g.rows.some(
      (r) =>
        (r.range.kind === "range" && r.range.inferred) ||
        (r.context?.kind === "joined" && r.context.year.inferred) ||
        (r.context?.kind === "player" && r.context.years.kind === "range" && r.context.years.inferred),
    ),
  );

  const seen = new Map<string, TreeGroupKey[]>();
  for (const g of groups) for (const r of g.rows) seen.set(r.person.id, [...(seen.get(r.person.id) ?? []), g.key]);
  const unique = seen.size;
  const twice = [...seen.entries()].filter(([, keys]) => keys.length > 1);
  const nameOf = (id: string) => all.find((l) => l.person.id === id)!.person.fullName;
  const people = `${unique} ${unique === 1 ? "person" : "people"}`;
  const derived = "Derived from overlapping seasons on the same staff.";
  if (!twice.length) return { groups, unique, inferred, footnote: `${people}, derived from overlapping seasons on the same staff.` };

  // "Before joining" only when the source pins both years: the shared assistant seasons ended by the
  // season the person is first known on the coach's staff.
  const beforeJoining = twice.every(([id, keys]) => {
    if (!keys.includes("peers") || !keys.includes("mentees")) return false;
    const peer = (tree.peers as AnnotatedLink[]).find((l) => l.person.id === id);
    const mentee = menteeById.get(id);
    const peerEnd = peer?.years && !peer.years.ongoing ? peer.years.endYear : null;
    const joined = mentee?.years?.startYear;
    return !!peerEnd && !!joined && peerEnd <= joined;
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
  return { groups, unique, inferred, footnote: `${people}. ${why} ${derived}` };
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
