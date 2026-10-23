import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonLine, SkeletonRegion, SkeletonRows, SkeletonText, SkeletonTile } from "@/components/ui/Skeleton";

/**
 * Header card skeleton (§8.0) on the real card's rhythm, so nothing moves when content arrives:
 * tile, the display line (32px, 28 on phone), the 22px subtitle, 20px chips (mt-2), the stat band
 * (mt-5; 28px value over a 16px label; four columns, three on phone) and the 44px tab row under
 * its 1px divider.
 */
export function ProgramHeaderSkeleton() {
  return (
    <Card className="px-4 pt-4 md:px-6 md:pt-6">
      <SkeletonRegion label="Loading program">
        <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 gap-y-4 md:grid-cols-[56px_minmax(0,1fr)] md:gap-x-5 lg:grid-cols-[56px_minmax(0,1fr)_auto]">
          <SkeletonTile size={56} className="max-md:size-12! max-md:rounded-[10px]!" />
          <div className="min-w-0">
            {/* text-display line (28 phone / 32 desktop) */}
            <span className="flex h-7 items-center md:mt-0.5 md:h-8">
              <span className="block h-3 w-[58%] rounded-xs bg-hover" />
            </span>
            {/* subtitle: 20px line on phone (text-body), 22px from md (text-subtitle) */}
            <span className="mt-0.5 flex h-5 items-center md:h-[22px]">
              <span className="block h-2.5 w-[34%] rounded-xs bg-hover" />
            </span>
            <span className="mt-2 flex gap-1.5">
              <Skeleton className="h-5 w-11" />
              <Skeleton className="h-5 w-11" />
              <Skeleton className="h-5 w-24" />
            </span>
          </div>
          <span className="col-span-2 flex gap-2 md:col-span-1 md:col-start-2 lg:col-start-3 lg:row-start-1">
            <Skeleton className="h-11 flex-1 rounded-sm md:h-8 md:w-[104px] md:flex-none" />
            <Skeleton className="size-11 rounded-sm md:size-8" />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 border-t border-divider md:mt-5 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`py-3.5 pr-4 max-md:py-3 max-md:pr-1 [&+&]:border-l [&+&]:border-divider [&+&]:pl-5 max-md:[&+&]:pl-2.5${i === 3 ? " max-md:hidden" : ""}`}>
              <span className="flex h-7 items-center max-md:h-6">
                <span className="block h-3 w-9 rounded-xs bg-hover" />
              </span>
              <SkeletonLine width="70%" lineHeight={16} />
            </div>
          ))}
        </div>
        <div className="-mx-4 box-content flex h-11 items-center gap-8 border-t border-divider px-4 md:-mx-6 md:px-6">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      </SkeletonRegion>
    </Card>
  );
}

/** One list card: real chrome (border), a title block and up to 3 person rows. */
export function ProgramListSkeleton({ shape = "circle" }: { shape?: "circle" | "tile" }) {
  return (
    <Card padding="main">
      <SkeletonRegion>
        <SkeletonLine width={120} lineHeight={22} className="mb-3" />
        <SkeletonRows rows={3} avatar={40} shape={shape} />
      </SkeletonRegion>
    </Card>
  );
}

/** Rail card skeleton: title and 3 program rows with 32px tiles. */
export function ProgramRailSkeleton() {
  return (
    <Card padding="rail">
      <SkeletonRegion>
        <SkeletonText lines={2} widths={["52%", "38%"]} lineHeight={16} className="mb-3" />
        <SkeletonRows rows={3} avatar={32} shape="tile" />
      </SkeletonRegion>
    </Card>
  );
}
