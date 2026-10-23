import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

/**
 * Open to opportunities skeleton, matching the form: back link (44px tall on phone), title, the switch
 * row, the privacy band, three radio rows for "Who can see it", then chip rows for Roles and Regions.
 */
export default function AvailabilityLoading() {
  return (
    <SingleColumnLayout>
      <SkeletonRegion label="Loading Open to opportunities">
        <div className="mb-0 flex items-center max-md:min-h-11 max-md:px-4 max-md:pt-1 md:mb-1 md:h-[18px]">
          <Skeleton className="h-2.5 w-16" />
        </div>
        <Card padding="none">
          <div className="px-4 pb-4 pt-4 md:px-6 md:pt-5">
            <h1 className="text-title">Open to opportunities</h1>
            <SkeletonText className="mt-1" lines={1} widths={["70%"]} lineHeight={18} />
            <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
              <SkeletonText className="flex-1" lines={2} widths={["40%", "30%"]} />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <SkeletonLine className="mt-1" width={180} lineHeight={16} />
          </div>
          <div className="border-t border-divider bg-surface-2 px-4 py-3.5 md:px-6">
            <SkeletonText lines={3} widths={["36%", "88%", "76%"]} />
          </div>
          <div className="divide-y divide-divider px-4 md:px-6">
            {/* Who can see it: three radio rows (circle and two lines). */}
            <div className="py-4 md:py-5">
              <SkeletonLine width={96} lineHeight={18} />
              <div className="mt-1 flex flex-col gap-1">
                {["34%", "40%", "62%"].map((w, i) => (
                  <span key={i} className="flex min-h-8 items-start gap-2 py-1 max-md:min-h-11">
                    <SkeletonAvatar size={16} className="mt-0.5" />
                    <SkeletonText className="flex-1" lines={2} widths={[w, "48%"]} lineHeight={18} />
                  </span>
                ))}
              </div>
            </div>
            {/* Roles and Regions: label, help line, filter chips. */}
            {[5, 7].map((n) => (
              <div key={n} className="py-4 md:py-5">
                <SkeletonLine width={120} lineHeight={18} />
                <SkeletonLine className="mb-2.5" width="52%" lineHeight={16} />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Math.min(n, 3) }, (_, j) => (
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
