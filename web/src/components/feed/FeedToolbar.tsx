import Link from "next/link";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { FeedFilter } from "@/lib/queries/feedx";
import { ScopeMenu } from "./ScopeMenu";

const OPTIONS: { value: FeedFilter; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/feed" },
  { value: "moves", label: "Moves", href: "/feed?filter=moves" },
  { value: "jobs", label: "Jobs", href: "/feed?filter=jobs" },
];

/**
 * Feed toolbar (§8.5): segmented filter All · Moves · Jobs (links, ?filter=) and the "Showing
 * Division III" scope menu on the right (lg). Phone: segments full width with a 16px gutter.
 */
export function FeedToolbar({ filter }: { filter: FeedFilter }) {
  return (
    <div className="flex items-center justify-between gap-3 max-md:px-4 max-md:pb-1 max-md:pt-3">
      <SegmentedControl label="Filter feed" value={filter} options={OPTIONS} className="max-md:flex-1" />
      <ScopeMenu />
    </div>
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
