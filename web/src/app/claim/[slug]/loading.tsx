import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar, SkeletonRegion, SkeletonText, SkeletonTile } from "@/components/ui/Skeleton";

/** Claim flow skeleton: header card (avatar, two lines, three step blocks) and the first step card. */
export default function ClaimLoading() {
  return (
    <SingleColumnLayout>
      <SkeletonRegion label="Loading claim" className="flex flex-col gap-2 md:gap-3">
        <Card padding="none">
          <div className="flex items-start gap-3 p-4 md:px-6 md:pb-4 md:pt-5">
            <SkeletonAvatar size={48} />
            <SkeletonText className="flex-1" lines={3} widths={["44%", "30%", "56%"]} lineHeight={20} />
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-divider px-4 py-3 md:px-6 md:py-4">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-col items-center gap-1.5 md:flex-row md:gap-2">
                <SkeletonAvatar size={24} />
                <Skeleton className="h-2.5 w-20" />
              </span>
            ))}
          </div>
        </Card>
        <Card padding="main">
          <Skeleton className="h-3 w-40" />
          <SkeletonText className="mt-3" lines={2} widths={["92%", "64%"]} />
          <div className="mt-5 flex items-center gap-3">
            <SkeletonTile size={32} />
            <SkeletonText className="flex-1" lines={2} widths={["50%", "36%"]} />
          </div>
          <Skeleton className="mt-5 h-9 w-full max-w-[400px] rounded-sm" />
          <Skeleton className="mt-4 h-8 w-28 rounded-sm" />
        </Card>
      </SkeletonRegion>
    </SingleColumnLayout>
  );
}
