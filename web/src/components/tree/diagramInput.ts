import { titleShort } from "@/lib/format";
import type { SecondLevelMember, TreeExplorer, TreeMember } from "@/lib/queries/tree";
import {
  GROUP_LABEL,
  edgesInWords,
  listNames,
  otherPrograms,
  playerRange,
  playerSentence,
  playerText,
  possessive,
  programsInWords,
  rangeView,
  relationSentence,
  relationShort,
  type GroupKey,
  type RangeView,
} from "./copy";
import type { DiagramInput, DiagramMemberInput, DiagramSecondInput } from "./layout";

/** How many people of each group the diagram draws; the list always shows everyone. */
export const CAP = { mentors: 12, peers: 24, mentees: 36, up: 18, down: 36 };

/**
 * What the tap sheet shows for a node (DESIGN.md §8.8): the person row (avatar, name, title · program,
 * range with its dotted marks), the relationship and any player relationship, and why a dotted year is
 * dotted, in visible words (tooltips don't exist on touch).
 */
export type SheetInfo = {
  slug: string;
  name: string;
  /** The group the tapped node sits in ("Coached under Ian"), the sheet's title. */
  group: string;
  role: string | null;
  range: Pick<RangeView, "kind" | "parts" | "label" | "reasons">;
  relation: string;
  player: { text: string; range: Pick<RangeView, "kind" | "parts" | "label" | "reasons"> | null } | null;
  /** The quoted evidence behind dotted years, in plain words. */
  why: string | null;
  you: boolean;
  isDemo: boolean;
};

export type HiddenCount = { group: string; shown: number; total: number };

/** "Dotted years are inferred from …" (no second full stop after a closing quote). */
const inferredWhy = (reasons: string[]) => {
  const text = `Dotted years are inferred ${reasons.join("; ")}`;
  return /[”.]$/.test(text) ? text : `${text}.`;
};

const slimRange = (r: RangeView) => ({ kind: r.kind, parts: r.parts, label: r.label, reasons: r.reasons });

/**
 * The program a whole group shares, when it isn't the coach's current one (that one goes without
 * saying, as in the list): named once in the group's pill instead of on every node.
 */
function sharedProgram(members: TreeMember[], currentSlug: string | null): string | null {
  const sets = members.map((m) => otherPrograms(m.edges, currentSlug));
  if (!sets.length || sets.some((s) => s.length !== 1)) return null;
  return sets.every((s) => s[0] === sets[0][0]) ? sets[0][0] : null;
}

/** The diagram's input, the tap-sheet data per node, and which groups the diagram caps. */
export function buildDiagram(data: TreeExplorer, viewerId: string | null): { input: DiagramInput; hidden: HiddenCount[]; sheets: Record<string, SheetInfo> } {
  const { focal } = data;
  const first = focal.firstName;
  const currentSlug = focal.currentOrg?.slug ?? null;
  const rolePart = (p: { currentTitle: string | null; org: { shortName: string } | null }) => [p.currentTitle, p.org?.shortName].filter(Boolean).join(", ");
  const roleLine = (p: { currentTitle: string | null; org: { shortName: string } | null }) =>
    [p.currentTitle && titleShort(p.currentTitle), p.org?.shortName].filter(Boolean).join(" · ") || null;
  const shared = {
    mentors: sharedProgram(data.mentors, currentSlug),
    // Peers sit beside the coach, where a longer pill would widen the diagram: their programs stay on the nodes.
    peers: null,
    mentees: sharedProgram(data.mentees, currentSlug),
  };
  const sheets: Record<string, SheetInfo> = {};
  const groupName: Record<GroupKey, string> = { mentors: GROUP_LABEL.mentors(), peers: GROUP_LABEL.peers(), mentees: GROUP_LABEL.mentees(first) };

  const member =
    (group: GroupKey) =>
    (m: TreeMember): DiagramMemberInput => {
      const key = `${group}:${m.person.id}`;
      const role = rolePart(m.person);
      const you = m.person.id === viewerId;
      const rv = rangeView(m.edges);
      const programs = otherPrograms(m.edges, currentSlug);
      const program = programs.length && !(programs.length === 1 && programs[0] === shared[group]) ? listNames(programs) : null;
      const player = m.player ? ` ${playerSentence(m.player, first)}.` : "";
      const pr = m.player ? playerRange(m.player) : null;
      const reasons = [...new Set([...rv.reasons, ...(pr?.reasons ?? [])])];
      sheets[key] = {
        slug: m.person.slug,
        name: m.person.fullName,
        group: groupName[group],
        role: roleLine(m.person),
        range: slimRange(rv),
        relation: relationShort(group, first, m.edges),
        player: m.player ? { text: playerText(m.player, first), range: pr ? slimRange(pr) : null } : null,
        why: reasons.length ? inferredWhy(reasons) : null,
        you,
        isDemo: m.person.isDemo,
      };
      return {
        key,
        slug: m.person.slug,
        name: m.person.fullName,
        you,
        program,
        range: { parts: rv.parts, short: rv.short, title: rv.title },
        label: `${m.person.fullName}${you ? " (you)" : ""}${role ? `, ${role}` : ""}. ${relationSentence(group, first, m.edges)}.${player}`,
      };
    };

  const second =
    (dir: "up" | "down") =>
    (m: SecondLevelMember): DiagramSecondInput => {
      const key = `${dir}:${m.person.id}`;
      const link = m.links[0];
      const role = rolePart(m.person);
      const you = m.person.id === viewerId;
      const rv = rangeView(link.edges);
      // Under a "Via {name}" caption, the program goes without saying when it is that coach's current one.
      const programs = otherPrograms(link.edges, link.via.org?.slug ?? null);
      const how = (l: (typeof m.links)[number], withYears: boolean) => {
        const where = withYears ? edgesInWords(l.edges) : programsInWords(l.edges);
        return dir === "up" ? `${possessive(l.via.fullName)} head coach at ${where}` : `On ${possessive(l.via.fullName)} staff at ${where}`;
      };
      sheets[key] = {
        slug: m.person.slug,
        name: m.person.fullName,
        group: dir === "up" ? GROUP_LABEL.up() : GROUP_LABEL.down(),
        role: roleLine(m.person),
        range: slimRange(rv),
        relation: listNames(m.links.map((l) => how(l, false))),
        player: null,
        why: rv.reasons.length ? inferredWhy(rv.reasons) : null,
        you,
        isDemo: m.person.isDemo,
      };
      return {
        key,
        slug: m.person.slug,
        name: m.person.fullName,
        you,
        program: programs.length ? listNames(programs) : null,
        range: { parts: rv.parts, short: rv.short, title: rv.title },
        label: `${m.person.fullName}${you ? " (you)" : ""}${role ? `, ${role}` : ""}. Two steps away: ${listNames(m.links.map((l) => how(l, true)))}.`,
        parents: m.links.map((l) => ({ key: `${dir === "up" ? "mentors" : "mentees"}:${l.via.id}`, program: l.edges[0].org.shortName })),
      };
    };

  const mentors = data.mentors.slice(0, CAP.mentors).map(member("mentors"));
  const peers = data.peers.slice(0, CAP.peers).map(member("peers"));
  const mentees = data.mentees.slice(0, CAP.mentees).map(member("mentees"));
  const shownKeys = new Set([...mentors, ...mentees].map((m) => m.key));
  const keep = (s: DiagramSecondInput) => ({ ...s, parents: s.parents.filter((p) => shownKeys.has(p.key)) });
  const upAll = (data.second?.up ?? []).map(second("up")).map(keep).filter((s) => s.parents.length);
  const downAll = (data.second?.down ?? []).map(second("down")).map(keep).filter((s) => s.parents.length);
  const up = upAll.slice(0, CAP.up);
  const down = downAll.slice(0, CAP.down);
  // Each block's caption counts everyone who connects through that coach, drawn or not.
  const counts = (list: DiagramSecondInput[]) => {
    const c: Record<string, number> = {};
    for (const s of list) c[s.parents[0].key] = (c[s.parents[0].key] ?? 0) + 1;
    return c;
  };

  const hidden: HiddenCount[] = [
    { group: `who ${first} worked under`, shown: mentors.length, total: data.mentors.length },
    { group: `who worked alongside ${first}`, shown: peers.length, total: data.peers.length },
    { group: `who coached under ${first}`, shown: mentees.length, total: data.mentees.length },
    { group: "two steps up", shown: up.length, total: data.second?.up.length ?? 0 },
    { group: "two steps down", shown: down.length, total: data.second?.down.length ?? 0 },
  ].filter((h) => h.shown < h.total);

  const pill = (text: string, count: number, extra: string | null = null) => (count ? { text, count, extra } : null);
  return {
    input: {
      focal: {
        key: "focal",
        slug: focal.slug,
        name: focal.fullName,
        title: focal.currentTitle,
        you: focal.id === viewerId,
        label: `${focal.fullName}${focal.id === viewerId ? " (you)" : ""}${focal.currentTitle ? `, ${focal.currentTitle}` : ""}. Open profile.`,
      },
      mentors,
      peers,
      mentees,
      up,
      down,
      pills: {
        mentors: pill(GROUP_LABEL.mentors(), data.mentors.length, shared.mentors),
        peers: pill(GROUP_LABEL.peers(), data.peers.length),
        mentees: pill(GROUP_LABEL.mentees(first), data.mentees.length, shared.mentees),
      },
      bands: {
        up: up.length ? { label: GROUP_LABEL.up(), counts: counts(upAll) } : null,
        down: down.length ? { label: GROUP_LABEL.down(), counts: counts(downAll) } : null,
      },
    },
    hidden,
    sheets,
  };
}
