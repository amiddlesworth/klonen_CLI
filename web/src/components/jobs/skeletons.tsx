import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton, SkeletonLine, SkeletonRegion, SkeletonRows, SkeletonText, SkeletonTile } from "@/components/ui/Skeleton";

/* Loading states that match the final layouts (§8.0 Skeleton): static blocks, real card chrome, at most 3 rows per list. */

function RowSkeleton() {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 p-4">
      <SkeletonTile size={40} />
      <div>
        <SkeletonLine width="62%" lineHeight={20} />
        <SkeletonLine width="78%" lineHeight={18} className="mt-0.5" />
        <div className="mt-2.5 flex gap-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    </div>
  );
}

export function JobHeaderSkeleton() {
  return (
    <div>
      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 md:grid-cols-[56px_minmax(0,1fr)] md:gap-x-4">
        <div className="flex">
          <SkeletonTile size={48} className="md:hidden" />
          <SkeletonTile size={56} className="max-md:hidden" />
        </div>
        <div>
          <SkeletonLine width="55%" lineHeight={22} />
          <SkeletonLine width="70%" lineHeight={22} />
          <div className="mt-2 flex gap-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 border-t border-divider md:mt-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-3 pr-3 [&+&]:border-l [&+&]:border-divider [&+&]:pl-4">
            <SkeletonLine width="60%" lineHeight={22} />
            <SkeletonLine width="45%" lineHeight={16} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function JobsListSkeleton() {
  return (
    <SkeletonRegion label="Loading jobs" className="flex flex-col gap-2 md:gap-3 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start lg:gap-3">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-divider px-4 py-3">
          <SkeletonLine width={120} />
          <SkeletonLine width={150} lineHeight={18} />
        </div>
        <div className="divide-y divide-divider">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </Card>
      <Card className="hidden px-6 pb-5 pt-5 lg:block">
        <JobHeaderSkeleton />
        <div className="mt-5 border-t border-divider pt-5">
          <SkeletonText lines={3} widths={["82%", "64%", "73%"]} lineHeight={22} />
        </div>
      </Card>
    </SkeletonRegion>
  );
}

export function JobsHeaderSkeleton() {
  return (
    <Card padding="main">
      <h1 className="text-display-sm">Jobs</h1>
      <SkeletonLine width="50%" lineHeight={18} className="mt-0.5" />
      <Skeleton className="mt-4 h-9 w-full max-md:h-11" />
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-8 w-28 rounded-sm max-md:h-10" />
        <Skeleton className="h-8 w-20 rounded-sm max-md:h-10" />
        <Skeleton className="h-8 w-28 rounded-sm max-md:h-10" />
      </div>
    </Card>
  );
}

export function JobPageSkeleton() {
  return (
    <SkeletonRegion label="Loading job" className="flex flex-col gap-2 md:gap-3">
      <Card className="px-4 pt-4 md:px-6 md:pt-6">
        <JobHeaderSkeleton />
      </Card>
      <Card padding="main">
        <CardHeader title="About the role" />
        <SkeletonText lines={3} widths={["90%", "76%", "58%"]} lineHeight={22} />
      </Card>
      <Card padding="main">
        <CardHeader title="People from this program on the network" />
        <SkeletonRows rows={3} />
      </Card>
    </SkeletonRegion>
  );
}

export function RailSkeleton() {
  return (
    <SkeletonRegion label="Loading program">
      <Card padding="rail">
        <CardHeader size="rail" title="Program" />
        <SkeletonRows rows={1} shape="tile" className="mt-2" />
        <div className="mt-3 border-t border-divider pt-2">
          <SkeletonText lines={2} widths={["90%", "90%"]} lineHeight={18} />
        </div>
      </Card>
    </SkeletonRegion>
  );
}

export function PostJobSkeleton() {
  return (
    <SkeletonRegion label="Loading form" className="flex flex-col gap-2 md:gap-3">
      <Card padding="main">
        <SkeletonLine width="40%" lineHeight={22} />
        <SkeletonLine width="70%" lineHeight={18} />
        <div className="mt-6 flex flex-col gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <SkeletonLine width={120} lineHeight={18} />
              <Skeleton className="mt-1.5 h-9 w-full max-md:h-11" />
            </div>
          ))}
        </div>
      </Card>
    </SkeletonRegion>
  );
}
