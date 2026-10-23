import { Network, Send } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextLink } from "@/components/ui/TextLink";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import type { TreeExplorer, TreeMember } from "@/lib/queries/tree";
import {
  COVERAGE_NOTE,
  GROUP_LABEL,
  anyInferred,
  edgesInWords,
  listNames,
  otherPrograms,
  peopleCount,
  possessive,
  rangeView,
  relationSentence,
  treeFootnote,
  treeHref,
  type GroupKey,
} from "./copy";
import { layoutTree, type DiagramInput, type DiagramMemberInput, type DiagramSecondInput } from "./layout";
import { TreeDiagram } from "./TreeDiagram";
import { TreeList } from "./TreeList";

/** How many people of each group the diagram draws; the list always shows everyone. */
const CAP = { mentors: 12, peers: 24, mentees: 36, up: 12, down: 24 };

/**
 * The program a whole group shares, when it isn't the coach's current one (that one goes without
 * saying, as in the list): named once in the group's pill instead of on every node.
 */
function sharedProgram(members: TreeMember[], currentSlug: string | null): string | null {
  const sets = members.map((m) => otherPrograms(m.edges, currentSlug));
  if (!sets.length || sets.some((s) => s.length !== 1)) return null;
  return sets.every((s) => s[0] === sets[0][0]) ? sets[0][0] : null;
}

function buildInput(data: TreeExplorer, viewerId: string | null): { input: DiagramInput; hidden: { group: string; shown: number; total: number }[] } {
  const { focal } = data;
  const first = focal.firstName;
  const currentSlug = focal.currentOrg?.slug ?? null;
  const rolePart = (p: { currentTitle: string | null; org: { shortName: string } | null }) => [p.currentTitle, p.org?.shortName].filter(Boolean).join(", ");
  const shared = {
    mentors: sharedProgram(data.mentors, currentSlug),
    // Peers sit beside the coach, where a longer pill would widen the diagram: their programs stay on the nodes.
    peers: null,
    mentees: sharedProgram(data.mentees, currentSlug),
  };

  const member =
    (group: GroupKey) =>
    (m: TreeMember): DiagramMemberInput => {
      const role = rolePart(m.person);
      const you = m.person.id === viewerId;
      const rv = rangeView(m.edges);
      const programs = otherPrograms(m.edges, currentSlug);
      const program = programs.length && !(programs.length === 1 && programs[0] === shared[group]) ? listNames(programs) : null;
      return {
        key: `${group}:${m.person.id}`,
        slug: m.person.slug,
        name: m.person.fullName,
        you,
        program,
        range: { parts: rv.parts, short: rv.short, title: rv.title },
        label: `${m.person.fullName}${you ? " (you)" : ""}${role ? `, ${role}` : ""}. ${relationSentence(group, first, m.edges)}.`,
      };
    };
  const second =
    (dir: "up" | "down") =>
    (m: NonNullable<TreeExplorer["second"]>["up"][number]): DiagramSecondInput => {
      const link = m.links[0];
      const role = rolePart(m.person);
      const you = m.person.id === viewerId;
      const rv = rangeView(link.edges);
      // Under a "Via {name}" caption, the program goes without saying when it is that coach's current one.
      const programs = otherPrograms(link.edges, link.via.org?.slug ?? null);
      const how = (l: (typeof m.links)[number]) =>
        dir === "up" ? `${possessive(l.via.fullName)} head coach at ${edgesInWords(l.edges)}` : `On ${possessive(l.via.fullName)} staff at ${edgesInWords(l.edges)}`;
      return {
        key: `${dir}:${m.person.id}`,
        slug: m.person.slug,
        name: m.person.fullName,
        you,
        program: programs.length ? listNames(programs) : null,
        range: { parts: rv.parts, short: rv.short, title: rv.title },
        label: `${m.person.fullName}${you ? " (you)" : ""}${role ? `, ${role}` : ""}. Two steps away: ${listNames(m.links.map(how))}.`,
        parents: m.links.map((l) => ({ key: `${dir === "up" ? "mentors" : "mentees"}:${l.via.id}`, program: l.edges[0].org.shortName })),
      };
    };

  const mentors = data.mentors.slice(0, CAP.mentors).map(member("mentors"));
  const peers = data.peers.slice(0, CAP.peers).map(member("peers"));
  const mentees = data.mentees.slice(0, CAP.mentees).map(member("mentees"));
  const shownKeys = new Set([...mentors, ...mentees].map((m) => m.key));
  const keep = (s: DiagramSecondInput) => ({ ...s, parents: s.parents.filter((p) => shownKeys.has(p.key)) });
  const up = (data.second?.up ?? []).map(second("up")).map(keep).filter((s) => s.parents.length).slice(0, CAP.up);
  const down = (data.second?.down ?? []).map(second("down")).map(keep).filter((s) => s.parents.length).slice(0, CAP.down);

  const hidden = [
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
        up: up.length ? pill(GROUP_LABEL.up(), data.second?.up.length ?? 0) : null,
        down: down.length ? pill(GROUP_LABEL.down(), data.second?.down.length ?? 0) : null,
      },
    },
    hidden,
  };
}

/** The visible explanation of a dotted year (DESIGN.md §6.2), once per view that shows one. */
function InferredNote() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="num inf font-medium text-fg-2" aria-hidden="true">
        2004
      </span>
      Year inferred from a bio, not stated in it
    </span>
  );
}

/**
 * Diagram card (md and up): the SVG in two layouts (rows of 4 at md so it fits the card, rows of 6 at
 * lg), its legend and the footnote. The card is Escape's focus target, so focus stays visible.
 */
export function TreeDiagramCard({ data, depth, viewerId, className }: { data: TreeExplorer; depth: 1 | 2; viewerId: string | null; className?: string }) {
  const { input, hidden } = buildInput(data, viewerId);
  const wide = layoutTree(input, "wide");
  const narrow = layoutTree(input, "narrow");
  const first = data.focal.firstName;
  const inferred = anyInferred(data);
  const secondShown = input.up.length + input.down.length;
  const label = `${possessive(data.focal.fullName)} coaching tree`;
  return (
    <Card
      id="tree-diagram"
      padding="main"
      tabIndex={-1}
      aria-labelledby="tree-diagram-title"
      className={cn("focus-visible:rounded-md", className)}
    >
      <h2 id="tree-diagram-title" className="sr-only">
        Diagram
      </h2>
      <p id="tree-diagram-help" className="sr-only">
        Arrow keys move between coaches, Enter opens a profile and Escape leaves the diagram. The list view shows the same people.
      </p>
      <TreeDiagram layout={narrow} label={label} helpId="tree-diagram-help" exitTargetId="tree-diagram" className="-mx-4 px-4 md:-mx-6 md:px-6 lg:hidden" />
      <TreeDiagram layout={wide} label={label} helpId="tree-diagram-help" exitTargetId="tree-diagram" className="-mx-4 px-4 md:-mx-6 md:px-6 max-lg:hidden" />
      {depth === 2 && secondShown === 0 && (
        <p className="mt-3 text-center text-small text-fg-3">No one two steps away yet: none of the coaches above or below {first} have head-coach links of their own.</p>
      )}
      <div className="mt-4 border-t border-divider pt-3">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-fg-2" aria-label="Legend">
          <li className="inline-flex items-center gap-1.5">
            <svg width="24" height="12" aria-hidden="true" className="shrink-0">
              <path d="M1 2v3q0 5 5 5h17" strokeWidth={1.5} className="fill-none stroke-border-strong" />
            </svg>
            Overlapping seasons on one staff
          </li>
          {secondShown > 0 && (
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-full bg-hover shadow-[inset_0_0_0_1px_var(--border-strong)]" />
              Smaller circles are two steps away
            </li>
          )}
          {inferred && (
            <li>
              <InferredNote />
            </li>
          )}
          {wide.nodes.some((n) => n.you) && (
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3.5 rounded-full border-2 border-accent" />
              You
            </li>
          )}
        </ul>
        <p className="mt-2 text-caption text-fg-3">
          {treeFootnote(data)}
          {hidden.length > 0 && (
            <>
              {" "}
              The diagram shows {listNames(hidden.map((h) => `${h.shown} of ${h.total} ${h.group}`))};{" "}
              <TextLink href={treeHref(data.focal.slug, { view: "list", depth })} variant="inline" className="font-normal">
                the list shows everyone
              </TextLink>
              .
            </>
          )}
        </p>
        <p className="mt-1 text-caption text-fg-3">
          {COVERAGE_NOTE} <span className="pointer-coarse:hidden">Arrow keys move between coaches.</span>
        </p>
      </div>
    </Card>
  );
}

/** List card: everyone in the tree, grouped (the phone layout and the accessible equivalent). */
export function TreeListCard({ data, viewerId, className }: { data: TreeExplorer; viewerId: string | null; className?: string }) {
  const first = data.focal.firstName;
  const inferred = anyInferred(data);
  return (
    <Card padding="main" aria-labelledby="tree-list-title" className={className}>
      <CardHeader id="tree-list-title" title={`People in ${possessive(first)} tree`} meta={peopleCount(data.uniqueCount)} />
      <TreeList data={data} viewerId={viewerId} />
      <div className="mt-2 border-t border-divider pt-3 text-caption text-fg-3">
        {inferred && (
          <p className="mb-1 text-fg-2">
            <InferredNote />
          </p>
        )}
        <p>{treeFootnote(data)}</p>
        <p className="mt-1">{COVERAGE_NOTE}</p>
      </div>
    </Card>
  );
}

/** The one line under "No coaching tree yet.": what this coach's record holds, in plain words. */
function emptyReason(data: TreeExplorer): string {
  const { focal, record } = data;
  const first = focal.firstName;
  if (focal.isDemo) return `${focal.fullName} is a fictional demo coach, so no real coaches are linked to this tree.`;
  const { coachingStints, datedStints, programs, otherRoles } = record;
  if (coachingStints === 0 && otherRoles.length === 1)
    return `${possessive(first)} only listed role, ${otherRoles[0]}, isn't a coaching role, so it isn't used to build trees.`;
  if (coachingStints === 0 && otherRoles.length > 1)
    return `${possessive(first)} listed roles (${listNames(otherRoles)}) aren't coaching roles, so they aren't used to build trees.`;
  if (coachingStints === 0) return `${possessive(first)} record has no coaching stints in the source yet, so there is nothing to overlap.`;
  const stints = `${coachingStints} coaching ${coachingStints === 1 ? "stint" : "stints"}`;
  if (datedStints === 0) return `${possessive(first)} record lists ${stints}, but the source gives no years for ${coachingStints === 1 ? "it" : "them"}, so overlaps can't be worked out yet.`;
  return `${possessive(first)} record lists ${stints} at ${programs} ${programs === 1 ? "program" : "programs"}; no other coach on ${BRAND.name} shares those seasons yet.`;
}

/** Whole tree empty (DESIGN.md §8.8, §8.0): the profile card's title, one honest line, one secondary button. */
export function TreeEmptyCard({ data, inviteHref }: { data: TreeExplorer; inviteHref: string }) {
  return (
    <Card padding="main" aria-labelledby="tree-empty-title">
      <h2 id="tree-empty-title" className="sr-only">
        Coaching tree
      </h2>
      <EmptyState
        icon={Network}
        title="No coaching tree yet."
        description={emptyReason(data)}
        action={
          data.focal.isDemo ? undefined : (
            <ButtonLink href={inviteHref} icon={Send}>
              Invite a colleague
            </ButtonLink>
          )
        }
        spacing="lg"
      />
    </Card>
  );
}
