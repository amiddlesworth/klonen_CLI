import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonRows, SkeletonText, SkeletonTile } from "@/components/ui/Skeleton";

/** Header card skeleton (§8.4): avatar circle, two text lines, the stat band with three blocks. */
export function ProfileHeaderSkeleton() {
  return (
    <Card className="px-4 pt-4 md:px-6 md:pt-6">
      <div className="flex items-start gap-3 md:gap-5">
        <SkeletonAvatar size={80} className="max-md:size-14!" />
        <div className="min-w-0 flex-1 pt-1">
          <SkeletonLine width="44%" lineHeight={22} />
          <SkeletonLine width="68%" lineHeight={22} />
          <SkeletonLine width="36%" lineHeight={20} className="mt-2" />
        </div>
      </div>
      <div className="mt-4 flex gap-2 md:hidden">
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="h-11 flex-1 rounded-sm" />
        <Skeleton className="size-11 rounded-sm" />
      </div>
      <div className="mt-4 grid grid-cols-3 border-t border-divider md:mt-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-3.5 pr-4 [&+&]:border-l [&+&]:border-divider [&+&]:pl-5 max-md:[&+&]:pl-2.5">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="mt-2 h-2.5 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Experience skeleton: real chrome, two program groups (tile + 3 lines). */
export function ExperienceSkeleton() {
  return (
    <Card padding="main">
      <CardHeader title="Experience" />
      <Skeleton className="mb-4 h-4 w-full" />
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3 border-t border-divider py-4">
          <SkeletonTile size={40} />
          <SkeletonText className="flex-1" lines={3} widths={i ? ["48%", "30%", "62%"] : ["56%", "24%", "70%"]} />
        </div>
      ))}
    </Card>
  );
}

/** Full profile body while the record loads. */
export function ProfileMainSkeleton() {
  return (
    <SkeletonRegion label="Loading profile" className="flex flex-col gap-2 md:gap-3">
      <ProfileHeaderSkeleton />
      <Card padding="main">
        <CardHeader title="About" />
        <SkeletonText lines={3} widths={["86%", "78%", "52%"]} />
      </Card>
      <ExperienceSkeleton />
    </SkeletonRegion>
  );
}

/** Rail skeleton: the Current program card chrome with a tile and rows. */
export function ProfileRailSkeleton() {
  return (
    <>
      <Card padding="rail">
        <CardHeader title="Current program" size="rail" />
        <div className="mt-3 flex gap-3">
          <SkeletonTile size={40} />
          <SkeletonText className="flex-1" lines={2} widths={["70%", "45%"]} />
        </div>
        <SkeletonText className="mt-3" lines={2} widths={["90%", "90%"]} />
      </Card>
      <Card padding="rail">
        <CardHeader title="Same tree" size="rail" />
        <SkeletonRows rows={2} avatar={36} className="mt-3" />
      </Card>
    </>
  );
}

/** Breadcrumb placeholder (md and up). */
export function BreadcrumbSkeleton() {
  return <SkeletonLine width={220} lineHeight={20} />;
}
