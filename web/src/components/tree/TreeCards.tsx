import { Network, Send } from "lucide-react";
import { InferredKey } from "@/components/data/InferredYear";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextLink } from "@/components/ui/TextLink";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import type { TreeExplorer } from "@/lib/queries/tree";
import { COVERAGE_NOTE, anyInferred, emptySecondLevel, listNames, peopleCount, possessive, treeFootnote, treeHref } from "./copy";
import { DiagramInteractions } from "./DiagramInteractions";
import { buildDiagram } from "./diagramInput";
import { layoutTree, toClientLayout } from "./layout";
import { TreeDiagram } from "./TreeDiagram";
import { TreeList } from "./TreeList";

/**
 * Diagram card: the SVG in two layouts (rows of 4 below lg, where a phone scrolls it sideways; rows of 6
 * at lg), zoom controls, its legend and the footnote. The card is Escape's focus target, so focus stays
 * visible.
 */
export function TreeDiagramCard({ data, depth, viewerId, className }: { data: TreeExplorer; depth: 1 | 2; viewerId: string | null; className?: string }) {
  const { input, hidden, sheets } = buildDiagram(data, viewerId);
  const wide = layoutTree(input, "wide");
  const narrow = layoutTree(input, "narrow");
  const inferred = anyInferred(data);
  const secondShown = input.up.length + input.down.length;
  const secondTotal = (data.second?.up.length ?? 0) + (data.second?.down.length ?? 0);
  const label = `${possessive(data.focal.fullName)} coaching tree`;
  return (
    <Card id="tree-diagram" padding="main" tabIndex={-1} aria-labelledby="tree-diagram-title" className={cn("focus-visible:rounded-md", className)}>
      <h2 id="tree-diagram-title" className="sr-only">
        Diagram
      </h2>
      <p id="tree-diagram-help" className="sr-only">
        Arrow keys move between coaches, Enter opens a profile and Escape leaves the diagram. The list view shows the same people.
      </p>
      <DiagramInteractions sheets={sheets} exitTargetId="tree-diagram" className="-mx-4 px-4 md:-mx-6 md:px-6">
        <TreeDiagram layout={toClientLayout(narrow)} label={label} helpId="tree-diagram-help" className="lg:hidden" />
        <TreeDiagram layout={toClientLayout(wide)} label={label} helpId="tree-diagram-help" className="max-lg:hidden" />
      </DiagramInteractions>
      {depth === 2 && secondShown === 0 && (
        <p className="mt-3 text-center text-small text-fg-2 [text-wrap:balance]">
          {secondTotal > 0 ? (
            <>
              The {secondTotal === 1 ? "coach" : "coaches"} two steps away connect through people the diagram doesn&apos;t draw;{" "}
              <TextLink href={treeHref(data.focal.slug, { view: "list", depth })} variant="inline" className="font-normal">
                the list shows them
              </TextLink>
              .
            </>
          ) : (
            emptySecondLevel(data)
          )}
        </p>
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
          {/* The shared key without a sample year (audit C03): the diagram trims rows, so no one year is sure to be on it. */}
          {inferred && (
            <li>
              <InferredKey />
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

/** List card: everyone in the tree, grouped (the phone default and the accessible equivalent). */
export function TreeListCard({
  data,
  viewerId,
  depth,
  view,
  showAll,
  className,
}: {
  data: TreeExplorer;
  viewerId: string | null;
  depth: 1 | 2;
  view: "diagram" | "list";
  showAll: boolean;
  className?: string;
}) {
  const first = data.focal.firstName;
  const inferred = anyInferred(data);
  return (
    <Card padding="main" aria-labelledby="tree-list-title" className={className}>
      <CardHeader id="tree-list-title" title={`People in ${possessive(first)} tree`} meta={peopleCount(data.uniqueCount)} />
      <TreeList data={data} viewerId={viewerId} depth={depth} view={view} showAll={showAll} />
      <div className="mt-2 border-t border-divider pt-3 text-caption text-fg-3">
        {inferred && (
          <p className="mb-1 text-fg-2">
            <InferredKey />
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
  // One listed role: in the header's own words (the current title), so the page spells it one way.
  if (coachingStints === 0 && otherRoles.length === 1)
    return `${possessive(first)} only listed staff role, ${focal.currentTitle ?? otherRoles[0]}, isn't a coaching role, so it isn't used to build trees.`;
  if (coachingStints === 0 && otherRoles.length > 1)
    return `${possessive(first)} listed staff roles (${listNames(otherRoles)}) aren't coaching roles, so they aren't used to build trees.`;
  if (coachingStints === 0) return `${possessive(first)} record has no coaching stints in the source yet, so there is nothing to overlap.`;
  const stints = `${coachingStints} coaching ${coachingStints === 1 ? "stint" : "stints"}`;
  if (datedStints === 0) return `${possessive(first)} record lists ${stints}, but the source gives no years for ${coachingStints === 1 ? "it" : "them"}, so overlaps can't be worked out yet.`;
  return `${possessive(first)} record lists ${stints} at ${programs} ${programs === 1 ? "program" : "programs"}; no other coach on ${BRAND.name} shares those seasons yet.`;
}

/**
 * Whole tree empty (DESIGN.md §8.8, §8.0): the profile card's title, one honest line and, when a colleague
 * could actually fill the tree, one secondary button. A demo coach, or a record with no coaching role,
 * gets no invite: nobody's seasons can overlap a role that isn't used to build trees.
 */
export function TreeEmptyCard({ data, inviteHref }: { data: TreeExplorer; inviteHref: string }) {
  const canInvite = !data.focal.isDemo && data.record.coachingStints > 0;
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
          canInvite ? (
            <ButtonLink href={inviteHref} icon={Send}>
              Invite a colleague
            </ButtonLink>
          ) : undefined
        }
        spacing="lg"
      />
    </Card>
  );
}
