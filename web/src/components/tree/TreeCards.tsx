import { Network, Send } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import type { TreeExplorer } from "@/lib/queries/tree";
import {
  DERIVATION,
  GROUP_LABEL,
  anyInferred,
  edgeYears,
  edgesInWords,
  listNames,
  peopleCount,
  possessive,
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

function buildInput(data: TreeExplorer, viewerId: string | null): { input: DiagramInput; hidden: { group: string; shown: number; total: number }[] } {
  const { focal } = data;
  const first = focal.firstName;
  const rolePart = (p: { currentTitle: string | null; org: { shortName: string } | null }) =>
    [p.currentTitle, p.org?.shortName].filter(Boolean).join(", ");

  const member = (group: GroupKey) => (m: TreeExplorer["mentors"][number]): DiagramMemberInput => {
    const e = m.edges[0];
    const role = rolePart(m.person);
    const you = m.person.id === viewerId;
    return {
      key: `${group}:${m.person.id}`,
      slug: m.person.slug,
      name: m.person.fullName,
      you,
      rel: { program: e.org.shortName, range: edgeYears(e).compact, inferred: e.inferred },
      label: `${m.person.fullName}${you ? " (you)" : ""}${role ? `, ${role}` : ""}. ${relationSentence(group, first, m.edges)}${m.edges.some((x) => x.inferred) ? " (years partly inferred)" : ""}.`,
      edgeTitle: `${focal.fullName} and ${m.person.fullName} · ${edgesInWords(m.edges)}`,
    };
  };
  const second = (dir: "up" | "down") => (m: NonNullable<TreeExplorer["second"]>["up"][number]): DiagramSecondInput => {
    const link = m.links[0];
    const e = link.edges[0];
    const role = rolePart(m.person);
    const you = m.person.id === viewerId;
    const how = (l: (typeof m.links)[number]) =>
      dir === "up" ? `${possessive(l.via.fullName)} head coach at ${edgesInWords(l.edges)}` : `Coached under ${l.via.fullName} at ${edgesInWords(l.edges)}`;
    return {
      key: `${dir}:${m.person.id}`,
      slug: m.person.slug,
      name: m.person.fullName,
      you,
      rel: { program: e.org.shortName, range: edgeYears(e).compact, inferred: e.inferred },
      label: `${m.person.fullName}${you ? " (you)" : ""}${role ? `, ${role}` : ""}. Two steps away: ${listNames(m.links.map(how))}${m.links.some((l) => l.edges.some((x) => x.inferred)) ? " (years partly inferred)" : ""}.`,
      parents: m.links.map((l) => ({
        key: `${dir === "up" ? "mentors" : "mentees"}:${l.via.id}`,
        edgeTitle: `${l.via.fullName} and ${m.person.fullName} · ${edgesInWords(l.edges)}`,
      })),
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

  const pill = (text: string, count: number) => (count ? { text, count } : null);
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
        mentors: pill(GROUP_LABEL.mentors(), data.mentors.length),
        peers: pill(GROUP_LABEL.peers(), data.peers.length),
        mentees: pill(GROUP_LABEL.mentees(first), data.mentees.length),
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

/** Diagram card (md and up): the SVG, its legend and the footnote. */
export function TreeDiagramCard({ data, depth, viewerId, className }: { data: TreeExplorer; depth: 1 | 2; viewerId: string | null; className?: string }) {
  const { input, hidden } = buildInput(data, viewerId);
  const layout = layoutTree(input);
  const first = data.focal.firstName;
  const inferred = anyInferred(data);
  const secondShown = input.up.length + input.down.length;
  return (
    <Card padding="main" aria-labelledby="tree-diagram-title" className={className}>
      <h2 id="tree-diagram-title" tabIndex={-1} className="sr-only">
        Diagram
      </h2>
      <p id="tree-diagram-help" className="sr-only">
        Arrow keys move between coaches, Enter opens a profile and Escape leaves the diagram. The list view shows the same people.
      </p>
      <TreeDiagram layout={layout} label={`${possessive(data.focal.fullName)} coaching tree`} helpId="tree-diagram-help" exitTargetId="tree-diagram-title" />
      {depth === 2 && secondShown === 0 && (
        <p className="mt-3 text-center text-small text-fg-3">No one two steps away yet: none of {possessive(first)} mentors or staff alumni have their own overlaps on {BRAND.name}.</p>
      )}
      <div className="mt-4 border-t border-divider pt-3">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-fg-2" aria-label="Legend">
          <li className="inline-flex items-center gap-1.5">
            <svg width="24" height="12" aria-hidden="true" className="shrink-0">
              <path d="M1 2v3q0 5 5 5h17" strokeWidth={1.5} className="fill-none stroke-border-strong" />
            </svg>
            Overlapping seasons on one staff
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="grid size-[19px] place-items-center rounded-full border border-control bg-surface text-fg-2">
              <Icon icon={Network} size={12} />
            </span>
            Opens that coach&apos;s tree
          </li>
          {depth === 2 && (
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
          {layout.nodes.some((n) => n.you) && (
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3.5 rounded-full border-2 border-accent" />
              You
            </li>
          )}
          <li className="text-fg-3 lg:ml-auto">Arrow keys move between coaches</li>
        </ul>
        <p className="mt-2 text-caption text-fg-3">
          {treeFootnote(data)}
          {hidden.length > 0 && (
            <>
              {" "}
              The diagram shows{" "}
              {listNames(hidden.map((h) => `${h.shown} of ${h.total} ${h.group}`))}
              ;{" "}
              <TextLink href={treeHref(data.focal.slug, { view: "list", depth })} variant="inline" className="font-normal">
                the list shows everyone
              </TextLink>
              .
            </>
          )}
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
      </div>
    </Card>
  );
}

/** Whole tree empty: say so plainly, explain how trees are derived and what this coach's record holds. */
export function TreeEmptyCard({ data, inviteHref }: { data: TreeExplorer; inviteHref: string }) {
  const first = data.focal.firstName;
  const { coachingStints, datedStints, programs } = data.record;
  let record: string;
  if (coachingStints === 0) record = `${possessive(first)} record has no coaching stints in the source yet, so there is nothing to overlap.`;
  else if (datedStints === 0)
    record = `${possessive(first)} record lists ${coachingStints} coaching ${coachingStints === 1 ? "stint" : "stints"}, but the source gives no years for ${coachingStints === 1 ? "it" : "them"}, so overlaps can't be worked out yet.`;
  else
    record = `${possessive(first)} record lists ${coachingStints} coaching ${coachingStints === 1 ? "stint" : "stints"} at ${programs} ${programs === 1 ? "program" : "programs"}; no other coach on ${BRAND.name} shares those seasons yet.`;
  return (
    <Card padding="main" aria-labelledby="tree-empty-title">
      <h2 id="tree-empty-title" className="sr-only">
        Coaching tree
      </h2>
      <EmptyState
        icon={Network}
        title="No overlapping staff seasons found yet"
        description={record}
        action={
          <ButtonLink href={inviteHref} icon={Send}>
            Invite a colleague
          </ButtonLink>
        }
        spacing="lg"
      />
      <p className={cn("mx-auto max-w-prose border-t border-divider pt-3 text-center text-caption text-fg-3")}>
        How trees are derived: {DERIVATION} The tree fills in as coaches who worked with {first} are added.
      </p>
    </Card>
  );
}

