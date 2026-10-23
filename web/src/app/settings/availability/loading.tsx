import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

/** Open to opportunities skeleton: real card chrome and title, the switch row, the privacy band and three groups. */
export default function AvailabilityLoading() {
  return (
    <SingleColumnLayout>
      <SkeletonRegion label="Loading Open to opportunities">
        <Skeleton className="mb-2 h-2.5 w-16 max-md:mx-4 max-md:mt-3 md:mb-3" />
        <Card padding="none">
          <div className="px-4 pb-4 pt-4 md:px-6 md:pt-5">
            <h1 className="text-title">Open to opportunities</h1>
            <SkeletonText className="mt-1" lines={1} widths={["70%"]} lineHeight={18} />
            <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
              <SkeletonText className="flex-1" lines={2} widths={["40%", "30%"]} />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          </div>
          <div className="border-y border-divider bg-surface-2 px-4 py-3.5 md:px-6">
            <SkeletonText lines={3} widths={["36%", "88%", "76%"]} />
          </div>
          <div className="divide-y divide-divider px-4 md:px-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="py-4 md:py-5">
                <Skeleton className="h-2.5 w-28" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {[0, 1, 2].map((j) => (
                    <Skeleton key={j} className="h-8 w-24 rounded-sm max-md:h-10" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </SkeletonRegion>
    </SingleColumnLayout>
  );
}
