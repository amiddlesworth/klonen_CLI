import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { PAGE_TITLE } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

/**
 * Open to opportunities skeleton, matching the form: the real breadcrumb, title and its
 * two-line description, the switch row, the privacy band (title and four rows), three radio rows for "Who can see it", chip rows for Roles and Regions, then
 * the footer row with Cancel and Save.
 */
export default function AvailabilityLoading() {
  return (
    <SingleColumnLayout breadcrumb={<Breadcrumb items={[{ label: "Settings", href: "/settings" }]} current="Open to opportunities" phone="back" />}>
      <SkeletonRegion label="Loading Open to opportunities" className="flex flex-col gap-2 md:gap-3">
        <Card padding="none">
          <div className="px-4 pb-4 pt-4 md:px-6 md:pt-5">
            <h1 className={PAGE_TITLE}>Open to opportunities</h1>
            <SkeletonText className="mt-1 max-w-prose" lines={2} widths={["94%", "36%"]} lineHeight={18} />
            <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
              <SkeletonText className="flex-1" lines={2} widths={["40%", "30%"]} />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <SkeletonLine className="mt-1" width={180} lineHeight={16} />
          </div>
          {/* How this stays private: title, then four icon rows (two lines each on phone; only the first wraps on desktop). */}
          <div className="border-t border-divider bg-surface-2 px-4 py-3.5 md:px-6">
            <SkeletonLine width={140} lineHeight={18} />
            <div className="mt-2 space-y-2">
              {["92%", "96%", "84%", "80%"].map((w, i) => (
                <span key={i} className="flex items-start gap-2">
                  <Skeleton className="mt-0.5 size-4 shrink-0" />
                  <span className="flex-1">
                    <SkeletonLine width={w} lineHeight={18} />
                    <SkeletonLine width={i % 2 ? "38%" : "52%"} lineHeight={18} className={i > 0 ? "md:hidden" : undefined} />
                  </span>
                </span>
              ))}
            </div>
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
          {/* Footer: the (empty) status line, then Cancel and Save, a 2-column grid of 40px buttons on phone. */}
          <div className="flex flex-col gap-3 border-t border-divider px-4 py-3 md:flex-row md:items-center md:px-6">
            <div className="min-w-0 flex-1" />
            <div className="grid grid-cols-2 gap-2 md:flex">
              <Skeleton className="h-8 rounded-sm max-md:h-10 md:w-[68px]" />
              <Skeleton className="h-8 rounded-sm max-md:h-10 md:w-[52px]" />
            </div>
          </div>
        </Card>
      </SkeletonRegion>
    </SingleColumnLayout>
  );
}
