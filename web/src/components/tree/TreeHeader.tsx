import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DemoLabel } from "@/components/data/Badges";
import { StatGroup, type Stat } from "@/components/data/StatGroup";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { FilterChip } from "@/components/ui/FilterChip";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextLink } from "@/components/ui/TextLink";
import { cn } from "@/lib/cn";
import type { TreeExplorer } from "@/lib/queries/tree";
import { GROUP_LABEL, peopleCount, possessive, treeHref } from "./copy";

/** "Pacific (OR) › Staff › Ian Falconer › Coaching tree" (md and up; the phone header has a back link). */
export function TreeBreadcrumb({ data }: { data: TreeExplorer }) {
  const { focal } = data;
  const org = focal.currentOrg;
  const crumbs: { href: string; label: string }[] = [];
  if (org?.inRegistry) {
    crumbs.push({ href: `/programs/${org.slug}`, label: org.shortName });
    crumbs.push({ href: `/programs/${org.slug}?tab=staff`, label: "Staff" });
  }
  crumbs.push({ href: `/in/${focal.slug}`, label: focal.fullName });
  return (
    <nav aria-label="Breadcrumb" className="max-md:hidden md:-mt-1">
      <ol className="flex flex-wrap items-center gap-1 text-small leading-6 text-fg-2">
        {crumbs.map((c) => (
          <li key={c.href} className="flex items-center gap-1">
            <Link href={c.href} className="inline-flex min-h-6 items-center rounded-xs underline-offset-2 hover:text-fg-1 hover:underline">
              {c.label}
            </Link>
            <Icon icon={ChevronRight} size={14} className="text-fg-3" />
          </li>
        ))}
        <li aria-current="page" className="text-fg-1">
          Coaching tree
        </li>
      </ol>
    </nav>
  );
}

type TreeHeaderProps = {
  data: TreeExplorer;
  view: "diagram" | "list";
  depth: 1 | 2;
  /** The page defaulted to the list (a phone): links spell out view=diagram. */
  explicitView?: boolean;
};

/**
 * Page header card (DESIGN.md §8.8): back link (phone), h1 "{Name}'s coaching tree", the coach's
 * role, "{n} people · derived from overlapping seasons", the Diagram · List control (md and up; the
 * phone always shows the list), the "Two steps away" toggle (?depth=2) and the group counts.
 */
export function TreeHeader({ data, view, depth, explicitView = false }: TreeHeaderProps) {
  const { focal } = data;
  const first = focal.firstName;
  const empty = data.uniqueCount === 0;
  const org = focal.currentOrg;

  const stats: Stat[] = [
    { value: data.mentors.length, label: GROUP_LABEL.mentors() },
    { value: data.peers.length, label: GROUP_LABEL.peers() },
    { value: data.mentees.length, label: GROUP_LABEL.mentees(first) },
    { value: data.uniqueCount, label: "People in tree", hideOnPhone: true },
  ];
  if (data.second) stats.push({ value: data.second.uniqueCount, label: "Two steps away", hideOnPhone: true });

  return (
    <Card aria-labelledby="tree-title" className={cn("px-4 pt-2 md:px-6 md:pt-5", empty && "pb-4 md:pb-5")}>
      <Link
        href={`/in/${focal.slug}`}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-xs pr-2 text-small font-medium text-fg-2 underline-offset-2 hover:text-fg-1 hover:underline md:hidden"
      >
        <Icon icon={ChevronLeft} size={16} />
        {focal.fullName}
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3 md:gap-4">
          <Avatar name={focal.fullName} tintKey={focal.slug} size={56} className="max-md:size-12 max-md:text-[17px]" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 id="tree-title" tabIndex={-1} className="text-display outline-none max-md:text-display-sm">
                {possessive(focal.fullName)} coaching tree
              </h1>
              {/* A fictional demo coach says so on the record itself (ARCHITECTURE "Demo data honesty"). */}
              {focal.isDemo && <DemoLabel />}
            </div>
            {focal.currentTitle && (
              <p className="mt-0.5 text-body text-fg-2">
                {focal.currentTitle}
                {org && (
                  <>
                    {" at "}
                    {org.inRegistry ? (
                      <TextLink href={`/programs/${org.slug}`} variant="plain" className="font-medium text-fg-1">
                        {org.name}
                      </TextLink>
                    ) : (
                      <span className="font-medium text-fg-1">{org.name}</span>
                    )}
                  </>
                )}
              </p>
            )}
            <p className="mt-0.5 text-small text-fg-3">
              <span className="num">{peopleCount(data.uniqueCount)}</span> · derived from overlapping seasons
            </p>
            {!empty && <p className="mt-0.5 text-caption text-fg-3 md:hidden">Shown as a list on phones; the diagram opens on wider screens.</p>}
          </div>
        </div>
        {!empty && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 max-md:pb-1 md:pl-[72px] lg:pl-0">
            <SegmentedControl
              label="View"
              value={view}
              fullWidthOnPhone={false}
              className="max-md:hidden"
              options={[
                { value: "diagram", label: "Diagram", href: treeHref(focal.slug, { view: "diagram", depth, explicit: explicitView }) },
                { value: "list", label: "List", href: treeHref(focal.slug, { view: "list", depth }) },
              ]}
            />
            <FilterChip href={treeHref(focal.slug, { view, depth: depth === 2 ? 1 : 2, explicit: explicitView })} selected={depth === 2}>
              Two steps away
            </FilterChip>
          </div>
        )}
      </div>
      {/* Labels may wrap on phone ("Coached under {first}" is never cut off in a 3-column band); balanced, so no word is left alone. */}
      {!empty && <StatGroup stats={stats} label="Coaching tree counts" className="mt-4 max-md:[&_span]:whitespace-normal max-md:[&_span]:[text-wrap:balance]" />}
    </Card>
  );
}
