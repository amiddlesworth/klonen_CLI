import { BRAND } from "@/lib/brand";
import type { SecondLevelMember, TreeEdge, TreeExplorer, TreeMember, TreePerson, TreePlayerLink } from "@/lib/queries/tree";
import { compactParts, rangeInWords, yearsDisplay, yearsInWords, type RangePart } from "./years";

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

/**
 * "Ian Falconer" → "Ian Falconer's", "Chris" → "Chris'" (the profile's possessive() rule); drops a
 * trailing class year ("Matt Brown '12" → "Matt Brown's"). Every possessive on the page goes through it.
 */
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

const inferredTitle = (reasons: string[]) => (reasons.length ? `Inferred: ${reasons.join(" · ")}` : null);

/** Oldest run first, by the stored overlap (the order the visible range reads in). */
const oldestFirst = (a: TreeEdge, b: TreeEdge) => (a.startYear ?? a.endYear ?? 9999) - (b.startYear ?? b.endYear ?? 9999);

export function rangeView(edges: TreeEdge[]): RangeView {
  const dated = edges.filter((e) => yearsDisplay(e.years) === "range").sort((a, b) => (a.years.startYear ?? 0) - (b.years.startYear ?? 0));
  const current = edges.some((e) => yearsDisplay(e.years) === "current");
  const reasons = [...new Set(dated.flatMap((e) => e.reasons))];
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
  const it = inferredTitle(reasons);
  const title = current && it ? `${it} · Current: ${CURRENT_TITLE}` : it;
  return { kind: "range", parts, short, label: words.join("; "), reasons, title };
}

/** A player relationship's run ("2024–25"), only when the source pins both ends (the profile's rule). */
export function playerRange(player: TreePlayerLink): RangeView | null {
  if (yearsDisplay(player.years) !== "range") return null;
  return { kind: "range", parts: compactParts(player.years), short: null, label: yearsInWords(player.years), reasons: player.reasons, title: inferredTitle(player.reasons) };
}

/** One run in words: "2020–Present", "2022 (inferred)", "on the staff now (start year not in source)". */
function runInWords(e: TreeEdge): string {
  const d = yearsDisplay(e.years);
  if (d === "current") return "on the staff now (start year not in source)";
  if (d === "none") return "years not in source";
  return `${rangeInWords(e.years)}${e.inferred ? " (inferred)" : ""}`;
}

/**
 * Where and when, oldest first, each program named once: "Pacific (OR), 2022 and 2024";
 * "Oberlin, 2004–2005 and Pacific (OR), 2020–Present"; "Oberlin, 2004; Pacific (OR), 2016–2019 and 2022".
 */
export function edgesInWords(edges: TreeEdge[]): string {
  const byOrg = new Map<string, { name: string; runs: string[] }>();
  for (const e of [...edges].sort(oldestFirst)) {
    const o = byOrg.get(e.org.slug) ?? { name: e.org.shortName, runs: [] };
    o.runs.push(runInWords(e));
    byOrg.set(e.org.slug, o);
  }
  const parts = [...byOrg.values()].map((o) => `${o.name}, ${listNames(o.runs)}`);
  return [...byOrg.values()].every((o) => o.runs.length === 1) ? listNames(parts) : parts.join("; ");
}

/** The programs of these overlaps, oldest first, each once ("Oberlin and Pacific (OR)"). */
export function programsInWords(edges: TreeEdge[]): string {
  return listNames([...new Set([...edges].sort(oldestFirst).map((e) => e.org.shortName))]);
}

const supportOnly = (group: GroupKey, edges: TreeEdge[]) => group === "mentees" && edges.length > 0 && edges.every((e) => e.supportOnly);

/** Relationship sentence for a first-level member (labels, tooltips): where and when, in words. */
export function relationSentence(group: GroupKey, focalFirst: string, edges: TreeEdge[]): string {
  const where = edgesInWords(edges);
  if (group === "mentors") return `${possessive(focalFirst)} head coach at ${where}`;
  if (group === "peers") return `Worked alongside ${focalFirst} at ${where}`;
  // Support staff (operations, admin) were on the staff, not coaching under the coach.
  if (supportOnly(group, edges)) return `On ${possessive(focalFirst)} staff at ${where}, in a support role`;
  return `Coached under ${focalFirst} at ${where}`;
}

/** The same relationship without years, for the tap sheet (the range sits beside it). */
export function relationShort(group: GroupKey, focalFirst: string, edges: TreeEdge[]): string {
  const where = programsInWords(edges);
  if (group === "mentors") return `${possessive(focalFirst)} head coach at ${where}`;
  if (group === "peers") return `Worked alongside ${focalFirst} at ${where}`;
  if (supportOnly(group, edges)) return `On ${possessive(focalFirst)} staff at ${where} · support role`;
  return `Coached under ${focalFirst} at ${where}`;
}

/** "Played for Ian" / "Coached Tyler as a player" (the profile tree card's words). */
export function playerText(player: TreePlayerLink, focalFirst: string): string {
  return player.kind === "played_for" ? `Played for ${focalFirst}` : `Coached ${focalFirst} as a player`;
}

/** The player relationship as a sentence for labels: "Played for Ian, 2024–2025." */
export function playerSentence(player: TreePlayerLink, focalFirst: string): string {
  const range = playerRange(player);
  return `${playerText(player, focalFirst)}${range ? `, ${rangeInWords(player.years)}${player.years.startInferred || player.years.endInferred ? " (inferred)" : ""}` : ""}`;
}

/** A context line under a row: its text, and a year or a range that may carry the dotted mark. */
export type ContextView = {
  kind: "player" | "joined" | "support" | "at" | "also";
  text: string;
  year?: { value: number; inferred: boolean; reason: string | null };
  range?: RangeView | null;
};

/**
 * The context line under a first-level row, in the profile tree card's order (components/profile/model.ts
 * buildTree): a player relationship ("Played for Ian 2024–25", "Coached Tyler as a player"); for a peer
 * who later joined the coach's staff, "Joined Ian's staff in 2020"; for support staff, "On Spencer's staff
 * · support role"; else the program, when it is neither the coach's current one nor the program already
 * shown under the name.
 */
export function rowContext(group: GroupKey, m: TreeMember, data: Pick<TreeExplorer, "focal" | "mentees">): ContextView | null {
  const first = data.focal.firstName;
  if (m.player) return { kind: "player", text: playerText(m.player, first), range: playerRange(m.player) };
  if (group === "peers") {
    const joined = data.mentees.find((x) => x.person.id === m.person.id)?.edges.at(-1);
    const start = joined?.years.startYear;
    if (joined && start) {
      return { kind: "joined", text: `Joined ${possessive(first)} staff in`, year: { value: start, inferred: joined.years.startInferred, reason: joined.reasons[0] ?? null } };
    }
  }
  const currentSlug = data.focal.currentOrg?.slug ?? null;
  const programs = [...new Set(m.edges.filter((e) => e.org.slug !== currentSlug && e.org.slug !== m.person.org?.slug).map((e) => e.org.shortName))];
  if (supportOnly(group, m.edges)) return { kind: "support", text: `On ${possessive(first)} staff${programs.length ? ` at ${listNames(programs)}` : ""} · support role` };
  return programs.length ? { kind: "at", text: `At ${listNames(programs)}` } : null;
}

/** Programs of these overlaps other than the coach's current one (the current one goes without saying). */
export function otherPrograms(edges: TreeEdge[], currentSlug: string | null): string[] {
  return [...new Set(edges.filter((e) => e.org.slug !== currentSlug).map((e) => e.org.shortName))];
}

/** One "Via {name}" group of the second level: everyone whose (most recent) link runs through `via`. */
export type ViaGroup = { via: TreePerson; program: string | null; members: SecondLevelMember[] };

/**
 * Second-level people grouped by the first-level coach they connect through (their most recent link),
 * in the order those coaches appear in the coach's own groups. `program` is the program every link in
 * the group shares, named once in the subheading.
 */
export function viaGroups(members: SecondLevelMember[], order: TreeMember[]): ViaGroup[] {
  const groups = new Map<string, ViaGroup>();
  for (const m of members) {
    const via = m.links[0].via;
    const g = groups.get(via.id) ?? { via, program: null, members: [] };
    g.members.push(m);
    groups.set(via.id, g);
  }
  const rank = (id: string) => {
    const i = order.findIndex((x) => x.person.id === id);
    return i < 0 ? order.length : i;
  };
  return [...groups.values()]
    .sort((a, b) => rank(a.via.id) - rank(b.via.id))
    .map((g) => {
      const programs = new Set(g.members.flatMap((m) => m.links[0].edges.map((e) => e.org.shortName)));
      return { ...g, program: programs.size === 1 ? [...programs][0] : null };
    });
}

/** The line under a second-level row: other first-level coaches this person also connects through. */
export function alsoVia(m: SecondLevelMember): ContextView | null {
  if (m.links.length < 2) return null;
  return { kind: "also", text: `Also via ${listNames(m.links.slice(1).map((l) => `${l.via.fullName} · ${programsInWords(l.edges)}`))}` };
}

/**
 * Why a "Two steps away" view has no one in it. Links that exist but are out of time order are said so
 * (they show on the other coaches' own trees); only when there are none does it say there are none.
 */
export function emptySecondLevel(data: TreeExplorer): string {
  const first = data.focal.firstName;
  const dropped = data.second?.dropped ?? { up: 0, down: 0 };
  const why: string[] = [];
  const one = (n: number, a: string, b: string) => (n === 1 ? a : b);
  if (dropped.up) why.push(`${possessive(first)} ${one(data.mentors.length, "head coach", "head coaches")} worked under others only after coaching ${first}`);
  if (dropped.down)
    why.push(`${one(data.mentees.length, "the coach who", "the coaches who")} worked under ${first} led staffs of their own only before joining ${possessive(first)} staff`);
  if (why.length) return `No one two steps away in ${possessive(first)} lineage: ${listNames(why)}.`;
  return `No one two steps away yet: none of the coaches above or below ${first} have head-coach links of their own on ${BRAND.name}.`;
}

/** The footnote under the tree: unique count, who is listed twice and why, how the tree is derived. */
export function treeFootnote(data: TreeExplorer): string {
  const first = data.focal.firstName;
  const people = peopleCount(data.uniqueCount);
  const derived = "Derived from overlapping seasons on the same staff.";
  const twice = data.listedTwice;
  const support = data.mentees.some((m) => supportOnly("mentees", m.edges))
    ? ` Support staff on ${possessive(first)} staffs are listed under ${GROUP_LABEL.mentees(first)} and marked “support role”.`
    : "";
  if (!twice.length) return `${people}, derived from overlapping seasons on the same staff.${support}`;
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
      ? `${names[0]} is listed twice because ${twice[0].person.firstName} worked alongside ${first} before joining ${possessive(first)} staff.`
      : `${names[0]} is listed in two groups because the roles changed over the years.`;
  } else {
    why = beforeJoining
      ? `${listNames(names)} are listed twice because they worked alongside ${first} before joining ${possessive(first)} staff.`
      : `${listNames(names)} are listed in two groups because their roles changed over the years.`;
  }
  return `${people}. ${why} ${derived}${support}`;
}

/** Coverage is partial: the data holds the coaches on staffs we have read, so a tree is never complete. */
export const COVERAGE_NOTE = `Only coaches with a profile on ${BRAND.name} appear; coaches no longer on a covered staff may be missing.`;

/** Whether any year shown on the page is inferred (so the page must explain the dotted mark). */
export function anyInferred(data: TreeExplorer): boolean {
  const first = [...data.mentors, ...data.peers, ...data.mentees].some(
    (m) => m.edges.some((e) => e.inferred) || (!!m.player && !!playerRange(m.player) && (m.player.years.startInferred || m.player.years.endInferred)),
  );
  const second = !!data.second && [...data.second.up, ...data.second.down].some((m) => m.links.some((l) => l.edges.some((e) => e.inferred)));
  return first || second;
}

/**
 * Tree explorer URL with its view, depth and "show all rows" parameters. The diagram is the default
 * view, except for phones (list), so `explicit` spells out view=diagram where the default would be the list.
 */
export function treeHref(slug: string, opts: { view?: "diagram" | "list"; depth?: 1 | 2; all?: boolean; hash?: string; explicit?: boolean } = {}): string {
  const q = new URLSearchParams();
  if (opts.view === "list" || (opts.view === "diagram" && opts.explicit)) q.set("view", opts.view);
  if (opts.depth === 2) q.set("depth", "2");
  if (opts.all) q.set("all", "1");
  const qs = q.toString();
  return `/in/${slug}/tree${qs ? `?${qs}` : ""}${opts.hash ? `#${opts.hash}` : ""}`;
}
