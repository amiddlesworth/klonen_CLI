import Link from "next/link";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { FeedFilter, MoveFilterKind } from "@/lib/queries/feedx";
import { ScopeMenu } from "./ScopeMenu";

const OPTIONS: { value: FeedFilter; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/feed" },
  { value: "moves", label: "Moves", href: "/feed?filter=moves" },
  { value: "jobs", label: "Jobs", href: "/feed?filter=jobs" },
  { value: "milestones", label: "Milestones", href: "/feed?filter=milestones" },
];

/**
 * Feed toolbar (§8.5): segmented filter All · Moves · Jobs · Milestones (links, ?filter=) and the
 * ghost "Showing Division III ▾" scope menu on the right. Phone: four equal segments full width with a
 * 16px gutter, the scope under them (there is no filter sheet yet, so it stays in view).
 */
export function FeedToolbar({ filter }: { filter: FeedFilter }) {
  return (
    <div className="max-md:px-4 max-md:pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <SegmentedControl label="Filter feed" value={filter} options={OPTIONS} className="max-md:flex-1" />
        <ScopeMenu className="max-md:hidden" />
      </div>
      <ScopeMenu className="-ml-2.5 mt-1 md:hidden" />
    </div>
  );
}

const KIND_LABEL: Record<MoveFilterKind, string> = { hires: "hires", promotions: "promotions", other: "other role changes" };

/** The Moves filter narrowed to one tracker KPI: what is showing, and the way back to every move. */
export function FeedKindNote({ kind }: { kind: MoveFilterKind }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-small text-fg-2 max-md:px-4">
      <span>Showing {KIND_LABEL[kind]} only</span>
      <span aria-hidden="true">·</span>
      <Link href="/feed?filter=moves" className="target-24 font-medium text-link underline-offset-2 hover:underline">
        Show all moves
      </Link>
    </p>
  );
}

/** Pages after the first: where you are, and a way back to the top of the feed. */
export function FeedPageNote({ page, totalPages, topHref }: { page: number; totalPages: number; topHref: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-small text-fg-2 max-md:px-4">
      <span className="num">
        Page {page} of {totalPages}
      </span>
      <span aria-hidden="true">·</span>
      <Link href={topHref} className="target-24 font-medium text-link underline-offset-2 hover:underline">
        Back to the top of your feed
      </Link>
    </p>
  );
}
