import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { PIPELINE_STAGES, STAGE_LABEL } from "./stages";

/** Cards per column in the skeleton (at most 3 rows per list, §8.0). */
const ROWS = [3, 2, 2, 1] as const;

function CardSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="border-y border-border bg-surface md:rounded-md md:border">
      <div className="flex items-start gap-3 px-4 py-3.5 md:p-3">
        <SkeletonAvatar size={32} />
        <div className="min-w-0 flex-1">
          <SkeletonLine width={wide ? "62%" : "48%"} lineHeight={18} />
          <SkeletonLine width="84%" lineHeight={16} />
          <SkeletonLine width={wide ? "70%" : "58%"} lineHeight={16} className="mt-1" />
        </div>
      </div>
      <div className="flex justify-between border-t border-divider px-3 py-2.5">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  );
}

/**
 * Loading state for /employers/pipeline: the header card's real chrome (h1, Find candidates
 * position) with skeleton lines, and the board with real stage names over skeleton cards.
 */
export function PipelineSkeleton() {
  return (
    <SkeletonRegion label="Loading the hiring pipeline" className="flex flex-col gap-2 md:gap-3">
      <Card className="overflow-hidden">
        <div className="px-4 pt-4 md:px-6 md:pt-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-display-sm md:text-display">Hiring pipeline</h1>
              <SkeletonText lines={2} widths={["38%", "26%"]} lineHeight={22} className="mt-1 max-w-sm" />
            </div>
            <Skeleton className="h-11 w-full rounded-sm md:h-8 md:w-40" />
          </div>
          <div className="mt-4 grid grid-cols-4 border-t border-divider max-md:hidden">
            {PIPELINE_STAGES.map((s) => (
              <div key={s} className="py-3.5 pr-4 [&+&]:border-l [&+&]:border-divider [&+&]:pl-5">
                <SkeletonLine width={28} lineHeight={22} />
                <span className="text-caption text-fg-2">{STAGE_LABEL[s]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-divider bg-surface-2 px-4 py-3 max-md:mt-4 md:px-6">
          <SkeletonLine width="55%" lineHeight={20} />
        </div>
      </Card>

      <div className="px-4 pt-1 md:hidden">
        <Skeleton className="h-11 w-full rounded-sm" />
      </div>
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
    </SkeletonRegion>
  );
}
