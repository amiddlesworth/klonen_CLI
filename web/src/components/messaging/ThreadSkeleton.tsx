import { SkeletonAvatar, SkeletonText } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { PANE_HEADER_CLASS } from "./classes";

type ThreadSkeletonProps = {
  /** The phone back link block ("‹ Messaging"). */
  backLink?: boolean;
  /** Phone: only the header row (a neutral placeholder while the URL being loaded isn't known). */
  headerOnlyOnPhone?: boolean;
};

/**
 * The inside of a loading thread column (§8.0): header (back link on phone, avatar, two lines), three
 * messages (two on phone) and the composer (one row on phone; the two-line field and Send on md and up).
 */
export function ThreadSkeleton({ backLink = false, headerOnlyOnPhone = false }: ThreadSkeletonProps) {
  return (
    <>
      <div aria-hidden="true" className={cn(PANE_HEADER_CLASS, "gap-2 px-4 md:gap-3 md:px-6")}>
        {backLink && <span className="block h-2.5 w-20 shrink-0 rounded-xs bg-hover md:hidden" />}
        <SkeletonAvatar size={40} className="max-md:hidden" />
        <SkeletonAvatar size={32} className="md:hidden max-[400px]:hidden" />
        <SkeletonText className="flex-1" lines={2} widths={["38%", "64%"]} lineHeight={18} />
      </div>
      <div aria-hidden="true" className={cn("flex-1 px-4 md:px-6", headerOnlyOnPhone && "max-md:hidden")}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("flex gap-3 pt-5", i === 2 && "max-md:hidden")}>
            <SkeletonAvatar size={32} />
            <SkeletonText className="flex-1" lines={2} widths={["22%", i === 1 ? "54%" : "76%"]} />
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className={cn("flex items-center gap-2 border-t border-divider px-4 py-3 md:block md:px-6", headerOnlyOnPhone && "max-md:hidden")}
      >
        <span className="block h-11 flex-1 rounded-sm bg-hover md:h-[62px]" />
        <span className="block h-10 w-16 shrink-0 rounded-sm bg-hover md:ml-auto md:mt-2 md:h-8" />
      </div>
    </>
  );
}
