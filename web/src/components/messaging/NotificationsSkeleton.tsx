import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton, SkeletonAvatar, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

/** Notifications skeleton (§8.0): real card chrome and h1, the filter track and three rows. */
export function NotificationsSkeleton() {
  return (
    <SkeletonRegion label="Loading notifications">
      <Card>
        <div className="px-4 pt-4 md:px-6 md:pt-5">
          <PageHeader title="Notifications" className="mb-3" />
          <Skeleton className="h-8 w-[268px] rounded-sm max-md:h-11 max-md:w-full" />
        </div>
        <div className="mt-1">
          <div className="px-4 pb-2 pt-4 md:px-6">
            <Skeleton className="h-2.5 w-12" />
          </div>
          <ul aria-hidden="true" className="divide-y divide-divider border-t border-divider">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-4 md:px-6">
                <SkeletonAvatar size={40} />
                <SkeletonText className="flex-1" lines={2} widths={[i === 1 ? "72%" : "86%", "14%"]} />
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </SkeletonRegion>
  );
}
