import { Card } from "@/components/ui/Card";
import { SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { ForEmployers } from "./ForEmployers";
import { HowItWorks } from "./HowItWorks";
import { SectionHeader } from "./SectionHeader";

/** Proof band while the counts load: real card chrome, four value + label blocks, the source band. */
function ProofSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn("px-4 py-4 md:px-6 md:py-5 border-divider", i % 2 === 1 && "border-l", i >= 2 && "border-t md:border-t-0", i >= 1 && "md:border-l")}
          >
            <SkeletonLine width={i % 2 ? "44%" : "36%"} lineHeight={22} className="md:h-8!" />
            <SkeletonLine width={i % 2 ? "64%" : "72%"} lineHeight={18} className="mt-0.5" />
          </div>
        ))}
      </div>
      <div className="border-t border-divider bg-surface-2 px-4 py-3 md:px-6">
        <SkeletonLine width="80%" lineHeight={18} />
      </div>
    </Card>
  );
}

/** One sample profile card: avatar 48, name, title, chips, context, career line. */
function ProfileCardSkeleton({ i }: { i: number }) {
  return (
    <div className="flex h-full flex-col border-y border-border bg-surface p-4 md:rounded-md md:border">
      <div className="flex flex-1 gap-3 md:flex-col">
        <SkeletonAvatar size={48} />
        <div className="min-w-0 flex-1">
          <SkeletonText lines={2} lineHeight={20} widths={[i % 2 ? "58%" : "66%", i % 2 ? "80%" : "70%"]} />
          <SkeletonLine width="36%" lineHeight={20} className="mt-2" />
        </div>
      </div>
      <div className="mt-3 border-t border-divider pt-3 max-md:ml-15">
        <SkeletonLine width="75%" lineHeight={18} />
      </div>
    </div>
  );
}

/**
 * Loading state below the hero (§8.0): the data sections (proof band, sample profiles) as static
 * --hover blocks in their final layout with real headings and card chrome (three profile cards on
 * phone, four from md); the static sections render for real.
 */
export function LandingSectionsSkeleton() {
  return (
    <>
      <SkeletonRegion label="Loading coaches and programs" className="flex flex-col gap-10 md:gap-12">
        <ProofSkeleton />
        <section aria-labelledby="samples-title-loading">
          <SectionHeader
            id="samples-title-loading"
            title="Real coaching careers"
            description="Current Division III head coaches with long careers, each built from public staff bios."
          />
          <ul aria-hidden="true" className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={cn("min-w-0", i === 3 && "max-md:hidden")}>
                <ProfileCardSkeleton i={i} />
              </li>
            ))}
          </ul>
        </section>
      </SkeletonRegion>
      <HowItWorks />
      <ForEmployers example={null} />
    </>
  );
}
