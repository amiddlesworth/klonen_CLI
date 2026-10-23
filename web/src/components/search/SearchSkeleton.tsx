import { SidebarLayout } from "@/components/shell/Layouts";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

/** Facet rail while loading: real group titles would jump, so static blocks in their place. */
function FacetSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <SkeletonLine width="40%" lineHeight={22} />
      <Skeleton className="h-9 w-full rounded-sm" />
      {[0, 1, 2].map((g) => (
        <div key={g} className="flex flex-col gap-1">
          <SkeletonLine width="36%" lineHeight={20} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-8 items-center gap-2">
              <Skeleton className="size-4 rounded-xs" />
              <Skeleton className="h-2.5 flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Search start page while loading: the search card, then suggested searches and conferences. */
export function StartSkeleton() {
  return (
    <SidebarLayout sidebarLabel="Search filters" sidebar={<FacetSkeleton />}>
      <SkeletonRegion label="Loading search">
        <div className="flex flex-col gap-2 md:gap-3">
          <Card padding="main">
            <SkeletonLine width="48%" lineHeight={22} />
            <SkeletonLine width="80%" lineHeight={18} className="mt-0.5" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-sm max-md:h-11" />
              <Skeleton className="h-10 w-20 rounded-sm max-md:h-11" />
            </div>
            <Skeleton className="mt-3 h-10 w-full rounded-sm lg:hidden" />
          </Card>
          <Card padding="none" className="pt-4 md:pt-5">
            <div className="px-4 md:px-6">
              <SkeletonLine width="32%" lineHeight={22} />
            </div>
            <ul className="pb-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex min-h-12 items-center gap-3 px-4 py-2 md:px-6">
                  <Skeleton className="size-4 rounded-xs" />
                  <Skeleton className="h-2.5 flex-1" />
                  <Skeleton className="h-2.5 w-16" />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </SkeletonRegion>
    </SidebarLayout>
  );
}

/** Search loading state (§8.7): header and tabs, then 5 skeleton result rows. */
export function SearchSkeleton() {
  return (
    <SidebarLayout sidebarLabel="Search filters" sidebar={<FacetSkeleton />}>
      <SkeletonRegion label="Loading results">
        <Card padding="none">
          <div className="px-4 pt-4">
            <SkeletonLine width="44%" lineHeight={22} />
            <div className="mt-3 flex items-center gap-2 lg:hidden">
              <Skeleton className="h-10 w-28 rounded-sm" />
              <Skeleton className="h-10 w-24 rounded-sm" />
            </div>
          </div>
          <div className="mt-2 flex h-11 items-center gap-8 border-b border-divider px-4">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <ul className="divide-y divide-divider">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-start gap-3 p-4">
                <SkeletonAvatar size={48} />
                <div className="min-w-0 flex-1">
                  <SkeletonText lines={2} lineHeight={20} widths={[i % 2 ? "38%" : "48%", i % 2 ? "64%" : "56%"]} />
                  <div className="mt-1.5 flex gap-1">
                    <Skeleton className="h-5 w-10" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                  {/* The tree context line (12/16), so rows keep their height when content arrives. */}
                  <SkeletonLine width={i % 2 ? "36%" : "44%"} lineHeight={16} className="mt-0.5" />
                </div>
                <Skeleton className="size-7 rounded-sm max-md:size-10" />
              </li>
            ))}
          </ul>
        </Card>
      </SkeletonRegion>
    </SidebarLayout>
  );
}
