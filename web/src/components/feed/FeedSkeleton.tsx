import { ThreeColumnLayout } from "@/components/shell/Layouts";
import { Card, CardFooter } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonRows, SkeletonText } from "@/components/ui/Skeleton";
import type { FeedFilter } from "@/lib/queries/feedx";
import { FeedToolbar } from "./FeedToolbar";

/** Feed item skeleton (§8.5 feed states): avatar, 2 headline lines, 3 record lines, the action bar outline. */
function ItemSkeleton({ i }: { i: number }) {
  return (
    <Card as="div" className="overflow-hidden">
      <div className="px-4 pt-4">
        <div className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3">
          <SkeletonAvatar size={40} />
          <SkeletonText lines={2} widths={[i % 2 ? "78%" : "86%", "48%"]} lineHeight={20} />
        </div>
        <div className="mt-3 md:ml-[52px]">
          {[0, 1, 2].map((r) => (
            <div key={r} className="grid grid-cols-[56px_minmax(0,1fr)] items-center py-[3px]">
              <Skeleton className="h-2.5 w-9" />
              <SkeletonLine width={["62%", "54%", "70%"][(r + i) % 3]} />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-3 grid grid-cols-4 border-t border-divider px-2 py-1 max-md:px-0">
        {[0, 1, 2, 3].map((k) => (
          <span key={k} className="flex h-10 items-center justify-center gap-1.5 max-md:h-[52px] max-md:flex-col">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-2.5 w-14 max-md:w-12" />
          </span>
        ))}
      </div>
    </Card>
  );
}

/**
 * Loading state of /feed: real chrome and layout, static --hover blocks (no shimmer). The toolbar is
 * the real one with the requested filter selected, so a segment responds the moment it is pressed.
 */
export function FeedSkeleton({ filter = "all" }: { filter?: FeedFilter }) {
  const left = (
    <Card padding="rail">
      <SkeletonAvatar size={48} />
      <SkeletonText className="mt-3" lines={3} widths={["70%", "90%", "60%"]} />
      <div className="-mx-4 my-3 h-px bg-divider" />
      <SkeletonText lines={2} widths={["100%", "100%"]} lineHeight={22} />
    </Card>
  );
  const right = (
    <>
      <Card padding="rail">
        <h2 className="text-body font-semibold">Carousel tracker</h2>
        <SkeletonLine width="70%" lineHeight={16} />
        <div className="-mx-4 mt-3 grid grid-cols-3 border-y border-divider">
          {[0, 1, 2].map((k) => (
            <div key={k} className="px-4 pb-3 pt-2.5 [&+&]:border-l [&+&]:border-divider">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="mt-2 h-2.5 w-14" />
            </div>
          ))}
        </div>
        <div className="mt-3">
          {[0, 1, 2, 3, 4].map((k) => (
            <div key={k} className="flex items-center gap-3 py-[5px]">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-1.5 flex-1 rounded-[3px]" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          ))}
        </div>
        <CardFooter>
          <Skeleton className="h-2.5 w-20" />
        </CardFooter>
      </Card>
      <Card padding="rail">
        <h2 className="text-body font-semibold">People you may know</h2>
        <SkeletonRows rows={3} avatar={36} className="mt-3" />
      </Card>
    </>
  );
  return (
    <ThreeColumnLayout left={left} right={right} rightLabel="Carousel and suggestions">
      <h1 className="sr-only">Home feed</h1>
      <FeedToolbar filter={filter} />
      <SkeletonRegion label="Loading your feed" className="flex flex-col gap-2 md:gap-3">
        {[0, 1, 2].map((i) => (
          <ItemSkeleton key={i} i={i} />
        ))}
      </SkeletonRegion>
    </ThreeColumnLayout>
  );
}
