import { PageContainer } from "@/components/shell/Layouts";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonRows } from "@/components/ui/Skeleton";

/** A diagram node placeholder: avatar circle over two short lines. */
function NodeSkeleton({ size = 40 }: { size?: number }) {
  return (
    <div className="flex w-[124px] flex-col items-center gap-1.5">
      <SkeletonAvatar size={size} />
      <SkeletonLine width={84} lineHeight={16} />
      <SkeletonLine width={64} lineHeight={16} />
    </div>
  );
}

/**
 * Tree explorer skeleton (DESIGN.md §8.0, §8.8): header card with real chrome, then the centre node
 * and 6 skeleton nodes (md and up) or 3 list rows (phone).
 */
export default function TreeLoading() {
  return (
    <PageContainer
      breadcrumb={
        <div className="max-md:hidden">
          <SkeletonLine width={260} lineHeight={20} />
        </div>
      }
    >
      <SkeletonRegion label="Loading coaching tree" className="flex flex-col gap-2 md:gap-3">
        <Card className="px-4 pt-4 md:px-6 md:pt-5">
          <div className="flex items-start gap-3 md:gap-4">
            <SkeletonAvatar size={56} className="max-md:size-12!" />
            <div className="min-w-0 flex-1">
              <SkeletonLine width="min(340px, 80%)" lineHeight={22} />
              <SkeletonLine width="min(280px, 64%)" lineHeight={20} />
              <SkeletonLine width="min(220px, 50%)" lineHeight={18} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 border-t border-divider md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={i === 3 ? "py-3.5 pl-5 max-md:hidden" : "py-3 pr-2 md:py-3.5 [&+&]:pl-2.5 md:[&+&]:pl-5"}>
                <Skeleton className="h-5 w-8" />
                <SkeletonLine width={i === 2 ? 96 : 80} lineHeight={16} className="mt-1" />
              </div>
            ))}
          </div>
        </Card>
        <Card padding="main" className="max-md:hidden">
          <div className="flex flex-col items-center gap-10 py-6">
            <NodeSkeleton />
            <div className="flex flex-col items-center gap-2">
              <SkeletonAvatar size={64} />
              <SkeletonLine width={120} lineHeight={20} />
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-6">
              {Array.from({ length: 5 }, (_, i) => (
                <NodeSkeleton key={i} />
              ))}
            </div>
          </div>
        </Card>
        <Card padding="main" className="md:hidden">
          <SkeletonLine width="55%" lineHeight={22} className="mb-3" />
          <SkeletonRows rows={3} avatar={32} />
        </Card>
      </SkeletonRegion>
    </PageContainer>
  );
}
