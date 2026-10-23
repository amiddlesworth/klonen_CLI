import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonAvatar, SkeletonLine, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

/**
 * Claim flow skeleton (§8.0: matches the final layout, card titles render for real): the header card
 * (avatar, h1, name, headline, three steps), then step 1 as it renders: title, two description
 * lines, the email label, the input (36px, 44 on phone), its help line and the Send code button.
 */
export default function ClaimLoading() {
  return (
    <SingleColumnLayout>
      <SkeletonRegion label="Loading claim" className="flex flex-col gap-2 md:gap-3">
        <Card padding="none">
          <div className="flex items-start gap-3 p-4 md:px-6 md:pb-4 md:pt-5">
            <SkeletonAvatar size={48} />
            <span className="flex-1">
              <h1 className="text-title">Claim your profile</h1>
              <SkeletonLine className="mt-1" width="30%" lineHeight={20} />
              <SkeletonLine className="mt-0.5" width="56%" lineHeight={18} />
            </span>
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
        {/* Step 1, Confirm it's you: title, two description lines, the email label, input, help, Send code. */}
        <Card padding="main">
          <h2 className="text-title">Confirm it&apos;s you</h2>
          <SkeletonText className="mt-1 max-w-prose" lines={2} widths={["96%", "58%"]} lineHeight={18} />
          <SkeletonLine className="mt-4" width={84} lineHeight={18} />
          <Skeleton className="mt-1.5 h-9 w-full max-w-[400px] rounded-sm max-md:h-11" />
          <SkeletonLine className="mt-1.5" width="64%" lineHeight={16} />
          <Skeleton className="mt-4 h-8 w-28 rounded-sm max-md:h-10 max-md:w-full" />
        </Card>
      </SkeletonRegion>
    </SingleColumnLayout>
  );
}
