import { seasonRange, seasonRangeCompact, seasonRangeLabel } from "@/lib/format";
import type { TreeEdge, TreeExplorer, TreePerson } from "@/lib/queries/tree";

/*
 * Words for the tree explorer. One vocabulary at every width (DESIGN.md §3.6, §11 rule 11):
 * Worked under · Worked alongside · Coached under {first} · Two steps away. Never a gendered
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

/** The overlap's years as the tree shows them: compact ("2020–", "2010–12") and in words for labels. */
export function edgeYears(e: TreeEdge): { compact: string; full: string; label: string } {
  const end = e.isCurrent ? null : e.endYear;
  return {
    compact: seasonRangeCompact(e.startYear, end, e.isCurrent),
    full: seasonRange(e.startYear, end, e.isCurrent).range,
    label: seasonRangeLabel(e.startYear, end, e.isCurrent) + (e.inferred ? " (inferred)" : ""),
  };
}

/** "Pacific (OR), 2020–Present" and, for several overlaps, "Pacific (OR), 2016–2019 and Oberlin, 2004–2005". */
export function edgesInWords(edges: TreeEdge[]): string {
  return listNames(edges.map((e) => `${e.org.shortName}, ${edgeYears(e).full}`));
}

/** Relationship sentence for a first-level member, used in labels and tooltips. */
export function relationSentence(group: GroupKey, focalFirst: string, edges: TreeEdge[]): string {
  const where = edgesInWords(edges);
  if (group === "mentors") return `${focalFirst}'s head coach at ${where}`;
  if (group === "peers") return `Worked alongside ${focalFirst} at ${where}`;
  return `Coached under ${focalFirst} at ${where}`;
}

/**
 * The context line under a first-level row, the same rule as the profile tree card: the program
 * when it is not the coach's current one, and "Joined {first}'s staff in {year}" for someone who
 * worked alongside the coach before joining the coach's staff.
 */
export function rowContext(group: GroupKey, edges: TreeEdge[], data: Pick<TreeExplorer, "focal" | "mentees">, personId: string): string | null {
  const first = data.focal.firstName;
  if (group === "peers") {
    const joined = data.mentees.find((m) => m.person.id === personId)?.edges.at(-1);
    if (joined?.startYear) return `Joined ${first}'s staff in ${joined.startYear}`;
  }
  const programs = [...new Set(edges.map((e) => e.org.shortName))];
  const current = data.focal.currentOrg?.slug;
  if (programs.length === 1 && current && edges[0].org.slug === current) return null;
  return `At ${listNames(programs)}`;
}

/** Context line for a second-level row: "Via Jim Craft · on Jim's staff at Kenyon". */
export function secondContext(direction: "up" | "down", via: TreePerson, edges: TreeEdge[]): string {
  const programs = listNames([...new Set(edges.map((e) => e.org.shortName))]);
  return direction === "up"
    ? `Via ${via.fullName} · ${via.firstName}'s head coach at ${programs}`
    : `Via ${via.fullName} · on ${via.firstName}'s staff at ${programs}`;
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

/** How a tree is derived, in plain words (empty state and the legend's explainer). */
export const DERIVATION =
  "When two coaches' stints on the same program's staff share a season, they are connected: an assistant who overlaps a head coach worked under that coach, and two assistants on one staff worked alongside each other.";

/** Whether any year shown on the page is inferred (so the page must explain the dotted mark). */
export function anyInferred(data: TreeExplorer): boolean {
  const first = [...data.mentors, ...data.peers, ...data.mentees].some((m) => m.edges.some((e) => e.inferred));
  const second = !!data.second && [...data.second.up, ...data.second.down].some((m) => m.links.some((l) => l.edges.some((e) => e.inferred)));
  return first || second;
}

/** Tree explorer URL with its view and depth parameters. */
export function treeHref(slug: string, opts: { view?: "diagram" | "list"; depth?: 1 | 2; hash?: string } = {}): string {
  const q = new URLSearchParams();
  if (opts.view === "list") q.set("view", "list");
  if (opts.depth === 2) q.set("depth", "2");
  const qs = q.toString();
  return `/in/${slug}/tree${qs ? `?${qs}` : ""}${opts.hash ? `#${opts.hash}` : ""}`;
}
