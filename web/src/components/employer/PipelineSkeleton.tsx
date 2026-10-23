import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { PIPELINE_H1 } from "./PipelineFrame";
import { PIPELINE_STAGES, STAGE_LABEL } from "./stages";

/** Cards per column in the skeleton (at most 3 rows per list, §8.0). */
const ROWS = [3, 2, 2, 1] as const;

/** The candidate card's layout (header row, body under it from lg, footer with the next stage and More). */
function CardSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="border-y border-border bg-surface md:rounded-md md:border">
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 px-4 pb-3 pt-3.5 md:px-3 md:pt-3">
        <SkeletonAvatar size={32} className="row-span-2 lg:row-span-1" />
        <SkeletonLine width={wide ? "62%" : "48%"} lineHeight={20} className="lg:self-center" />
        <div className="min-w-0 lg:col-span-2 lg:mt-2">
          <SkeletonLine width="84%" lineHeight={16} className="mt-0.5 lg:mt-0" />
          <SkeletonLine width={wide ? "70%" : "58%"} lineHeight={16} className="mt-1" />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-divider px-2 py-1 md:px-1">
        <span className="flex h-10 items-center px-3 md:h-8 md:px-2">
          <Skeleton className="h-2.5 w-28" />
        </span>
        <span className="grid size-10 place-items-center md:size-8">
          <Skeleton className="h-2.5 w-4" />
        </span>
      </div>
    </div>
  );
}

/**
 * Loading state for /employers/pipeline (the page's Suspense fallback): the header card's real
 * chrome (h1, button and quick-search positions, the phone stage tabs) with skeleton blocks, and
 * the board with real stage names over skeleton cards.
 */
export function PipelineSkeleton() {
  return (
    <SkeletonRegion label="Loading the hiring pipeline" className="flex flex-col gap-2 md:gap-3">
      <Card className="overflow-hidden">
        <div className="px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0 flex-1">
              <h1 className={PIPELINE_H1}>Hiring pipeline</h1>
              <div className="mt-1 flex h-8 items-center">
                <SkeletonLine width={200} lineHeight={22} />
              </div>
              <SkeletonLine width={170} lineHeight={18} />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-11 flex-1 rounded-sm md:h-8 md:w-36 md:flex-none" />
              <Skeleton className="h-11 flex-1 rounded-sm md:h-8 md:w-36 md:flex-none" />
            </div>
          </div>
        </div>
        {/* Quick searches band (md and up): the real label, link-width blocks that show on --surface-2. */}
        <div className="h-11 items-center gap-4 border-t border-divider bg-surface-2 px-6 max-md:hidden md:flex">
          <p className="flex items-center gap-1.5 text-small text-fg-2">
            <Icon icon={Search} size={16} />
            Quick searches
          </p>
          {["w-28", "w-38", "w-30"].map((w) => (
            <Skeleton key={w} className={cn("h-2.5 bg-pressed", w)} />
          ))}
        </div>
        {/*
          Phone stage tabs: the real tabs' classes (Tabs + STAGE_TABS: growing, centered, 12px a side)
          with a digit-wide block where each count goes, so no label moves when the board loads.
        */}
        <div aria-hidden="true" className="flex border-t border-divider md:hidden">
          {PIPELINE_STAGES.map((s, i) => (
            <span
              key={s}
              className={cn(
                "relative inline-flex h-11 shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap px-3 text-small font-medium",
                i === 0 ? "text-fg-1 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-fg-1" : "text-fg-2",
              )}
            >
              {STAGE_LABEL[s]}
              <Skeleton className="h-2.5 w-2 rounded-[2px]" />
            </span>
          ))}
        </div>
      </Card>

      <div className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
        {PIPELINE_STAGES.map((s, i) => (
          <div key={s} className={cn("flex min-w-0 flex-col md:rounded-md md:bg-hover md:p-2", i > 0 && "max-md:hidden")}>
            <p className="px-1 pb-2 pt-0.5 text-small font-semibold max-md:hidden">{STAGE_LABEL[s]}</p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: ROWS[i] }, (_, j) => (
                <CardSkeleton key={j} wide={j % 2 === 0} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Phone: the quick searches follow the board. */}
      <Card className="md:hidden">
        <p className="px-4 pb-1 pt-3 text-title">Quick searches</p>
        {["60%", "48%", "56%"].map((w) => (
          <div key={w} className="flex h-11 items-center border-t border-divider px-4 first-of-type:border-t-0">
            <SkeletonLine width={w} lineHeight={20} />
          </div>
        ))}
      </Card>
    </SkeletonRegion>
  );
}
