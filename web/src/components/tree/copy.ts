import { BRAND } from "@/lib/brand";
import type { TreeEdge, TreeExplorer, TreePerson } from "@/lib/queries/tree";
import { compactParts, yearsDisplay, yearsInWords, type RangePart } from "./years";

/*
 * Words for the tree explorer. One vocabulary at every width (DESIGN.md §3.6, §11 rule 11):
 * Worked under · Worked alongside · Coached under {first} · Two steps up / down. Never a gendered
 * pronoun: gender is not in the data, so labels use the first name or neutral phrasing.
 */

export type GroupKey = "mentors" | "peers" | "mentees";

export const GROUP_LABEL = {
  mentors: () => "Worked under",
  peers: () => "Worked alongside",
  mentees: (first: string) => `Coached under ${first}`,
  up: () => "Two steps up",
  down: () => "Two steps down",
};

/** The tooltip on "Current", the same words as the profile's tree card. */
export const CURRENT_TITLE = "On the same staff now. The start year is not in the source.";

/** "Ian Falconer" → "Ian Falconer's"; drops a trailing class year ("Matt Brown '12" → "Matt Brown's"). */
export function possessive(name: string): string {
  const base = name.replace(/\s+['’]\d{2}$/, "").trim();
  return /s$/i.test(base) ? `${base}'` : `${base}'s`;
}

export function peopleCount(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What a member's years read as: every run with years (oldest first), "Current", or nothing. */
export type RangeView = {
  kind: "range" | "current" | "none";
  /** Compact pieces of every run, joined with ", " ("2022" ", " "2024"); "Current" as one piece. */
  parts: RangePart[];
  /** The most recent run only, with " · N stints" when there are several (for tight spots). */
  short: RangePart[] | null;
  /** For screen readers: every run in words, with which years are inferred. */
  label: string;
  /** Why the dotted years are dotted, quoting the evidence (DESIGN.md §6.2). */
  reasons: string[];
  /** Tooltip on the range: the reasons, or what "Current" means. */
  title: string | null;
};

export function rangeView(edges: TreeEdge[]): RangeView {
  const dated = edges.filter((e) => yearsDisplay(e.years) === "range").sort((a, b) => (a.years.startYear ?? 0) - (b.years.startYear ?? 0));
  const current = edges.some((e) => yearsDisplay(e.years) === "current");
  const reasons = [...new Set(dated.flatMap((e) => e.reasons))];
  const inferredTitle = reasons.length ? `Inferred: ${reasons.join(" · ")}` : null;
  if (!dated.length) {
    if (current) return { kind: "current", parts: [{ text: "Current", inferred: false }], short: null, label: "current, start year not in source", reasons: [], title: CURRENT_TITLE };
    return { kind: "none", parts: [], short: null, label: "years not in source", reasons: [], title: null };
  }
  const parts: RangePart[] = [];
  dated.forEach((e, i) => {
    if (i) parts.push({ text: ", ", inferred: false });
    parts.push(...compactParts(e.years));
  });
  if (current) parts.push({ text: ", ", inferred: false }, { text: "Current", inferred: false });
  const runs = dated.length + (current ? 1 : 0);
  const latest = dated[dated.length - 1];
  const short = runs > 1 ? [...compactParts(latest.years), { text: ` · ${runs} stints`, inferred: false }] : null;
  const words = [...dated.map((e) => yearsInWords(e.years)), ...(current ? ["current, start year not in source"] : [])];
  const title = current && inferredTitle ? `${inferredTitle} · Current: ${CURRENT_TITLE}` : inferredTitle;
  return { kind: "range", parts, short, label: words.join("; "), reasons, title };
}

/** "Pacific (OR), 2020–Present" for labels; "on the staff now" when the start year isn't in the source. */
function edgeInWords(e: TreeEdge): string {
  const d = yearsDisplay(e.years);
  if (d === "current") return `${e.org.shortName}, on the staff now (start year not in source)`;
  if (d === "none") return `${e.org.shortName} (years not in source)`;
  const s = e.years.startYear!;
  const range = e.years.ongoing ? `${s}–Present` : s === e.years.endYear ? String(s) : `${s}–${e.years.endYear}`;
  return `${e.org.shortName}, ${range}${e.inferred ? " (inferred)" : ""}`;
}

/** "Pacific (OR), 2020–Present" and, for several overlaps, "Pacific (OR), 2016–2019 and Oberlin, 2004–2005". */
export function edgesInWords(edges: TreeEdge[]): string {
  return listNames(edges.map(edgeInWords));
}

/** Relationship sentence for a first-level member, used in labels and tooltips. */
export function relationSentence(group: GroupKey, focalFirst: string, edges: TreeEdge[]): string {
  const where = edgesInWords(edges);
  if (group === "mentors") return `${focalFirst}'s head coach at ${where}`;
  if (group === "peers") return `Worked alongside ${focalFirst} at ${where}`;
  // Support staff (operations, admin) were on the staff, not coaching under the coach.
  if (edges.every((e) => e.supportOnly)) return `On ${focalFirst}'s staff at ${where}`;
  return `Coached under ${focalFirst} at ${where}`;
}

/** A context line with an optional year that may carry the dotted mark. */
export type ContextView = { text: string; year?: { value: number; inferred: boolean; reason: string | null } };

/**
 * The context line under a first-level row, the same rule as the profile tree card: "Joined {first}'s
 * staff in {year}" for someone who worked alongside the coach before joining the coach's staff, else the
 * program when it is not the coach's current one.
 */
export function rowContext(group: GroupKey, edges: TreeEdge[], data: Pick<TreeExplorer, "focal" | "mentees">, personId: string): ContextView | null {
  const first = data.focal.firstName;
  if (group === "peers") {
    const joined = data.mentees.find((m) => m.person.id === personId)?.edges.at(-1);
    const start = joined?.years.startYear;
    if (joined && start) {
      return { text: `Joined ${first}'s staff in`, year: { value: start, inferred: joined.years.startInferred, reason: joined.reasons[0] ?? null } };
    }
  }
  const programs = otherPrograms(edges, data.focal.currentOrg?.slug ?? null);
  return programs.length ? { text: `At ${listNames(programs)}` } : null;
}

/** Programs of these overlaps other than the coach's current one (the current one goes without saying). */
export function otherPrograms(edges: TreeEdge[], currentSlug: string | null): string[] {
  return [...new Set(edges.filter((e) => e.org.slug !== currentSlug).map((e) => e.org.shortName))];
}

/** Context line for a second-level row: "Via Jim Craft · Jim's head coach at Kenyon" / "Via … · on Jim's staff at …". */
export function secondContext(direction: "up" | "down", via: TreePerson, edges: TreeEdge[]): string {
  const programs = listNames([...new Set(edges.map((e) => e.org.shortName))]);
  return direction === "up" ? `Via ${via.fullName} · ${via.firstName}'s head coach at ${programs}` : `Via ${via.fullName} · on ${via.firstName}'s staff at ${programs}`;
}

/** The footnote under the tree: unique count, who is listed twice and why, how the tree is derived. */
export function treeFootnote(data: TreeExplorer): string {
  const first = data.focal.firstName;
  const people = peopleCount(data.uniqueCount);
  const derived = "Derived from overlapping seasons on the same staff.";
  const twice = data.listedTwice;
  if (!twice.length) return `${people}, derived from overlapping seasons on the same staff.`;
  const beforeJoining = twice.every(({ person, groups }) => {
    if (!groups.includes("peers") || !groups.includes("mentees")) return false;
    const peer = data.peers.find((m) => m.person.id === person.id)?.edges[0];
    const mentee = data.mentees.find((m) => m.person.id === person.id)?.edges.at(-1);
    return !!peer?.endYear && !!mentee?.startYear && peer.endYear <= mentee.startYear;
  });
  const names = twice.map((t) => t.person.fullName);
  let why: string;
  if (twice.length === 1) {
    why = beforeJoining
      ? `${names[0]} is listed twice because ${twice[0].person.firstName} worked alongside ${first} before joining ${first}'s staff.`
      : `${names[0]} is listed in two groups because the roles changed over the years.`;
  } else {
    why = beforeJoining
      ? `${listNames(names)} are listed twice because they worked alongside ${first} before joining ${first}'s staff.`
      : `${listNames(names)} are listed in two groups because their roles changed over the years.`;
  }
  return `${people}. ${why} ${derived}`;
}

/** Coverage is partial: the data holds the coaches on staffs we have read, so a tree is never complete. */
export const COVERAGE_NOTE = `Only coaches with a profile on ${BRAND.name} appear; coaches no longer on a covered staff may be missing.`;

/** Whether any year shown on the page is inferred (so the page must explain the dotted mark). */
export function anyInferred(data: TreeExplorer): boolean {
  const first = [...data.mentors, ...data.peers, ...data.mentees].some((m) => m.edges.some((e) => e.inferred));
  const second = !!data.second && [...data.second.up, ...data.second.down].some((m) => m.links.some((l) => l.edges.some((e) => e.inferred)));
  return first || second;
}

/**
 * Tree explorer URL with its view and depth parameters. The diagram is the default view, except for
 * phones (list), so `explicit` spells out view=diagram where the default would be the list.
 */
export function treeHref(slug: string, opts: { view?: "diagram" | "list"; depth?: 1 | 2; hash?: string; explicit?: boolean } = {}): string {
  const q = new URLSearchParams();
  if (opts.view === "list" || (opts.view === "diagram" && opts.explicit)) q.set("view", opts.view);
  if (opts.depth === 2) q.set("depth", "2");
  const qs = q.toString();
  return `/in/${slug}/tree${qs ? `?${qs}` : ""}${opts.hash ? `#${opts.hash}` : ""}`;
}
