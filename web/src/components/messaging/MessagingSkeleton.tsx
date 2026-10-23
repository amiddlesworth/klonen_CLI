import { InboxPane, MessagingCard, PANE_HEADER_CLASS, ThreadPane } from "@/components/messaging/MessagingFrame";
import { SkeletonAvatar, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

type MessagingSkeletonProps = {
  /**
   * What the phone shows while loading: the inbox (/messaging), or a conversation page (?thread=,
   * ?to=) with its back link, two messages and the one-row composer on the tab bar. Desktop always
   * shows both panes.
   */
  phone?: "inbox" | "thread";
};

/** Inbox and thread skeleton (§8.0): real card chrome and h1, three inbox rows, a thread header and three messages. */
export function MessagingSkeleton({ phone = "inbox" }: MessagingSkeletonProps) {
  const thread = phone === "thread";
  return (
    <SkeletonRegion label={thread ? "Loading conversation" : "Loading messages"}>
      <MessagingCard>
        <InboxPane hiddenOnPhone={thread}>
          <ul aria-hidden="true" className="divide-y divide-divider">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <SkeletonAvatar size={40} />
                <SkeletonText className="flex-1" lines={2} widths={[i % 2 ? "48%" : "60%", i % 2 ? "82%" : "70%"]} lineHeight={18} />
              </li>
            ))}
          </ul>
        </InboxPane>
        <ThreadPane threadId={null} hiddenOnPhone={!thread} fillOnPhone={thread} label="Loading conversation">
          <div aria-hidden="true" className={cn(PANE_HEADER_CLASS, "gap-2 px-4 md:gap-3 md:px-6")}>
            {/* The phone back link ("‹ Messaging"). */}
            <span className="block h-2.5 w-20 shrink-0 rounded-xs bg-hover md:hidden" />
            <SkeletonAvatar size={40} className="max-md:hidden" />
            <SkeletonAvatar size={32} className="md:hidden max-[400px]:hidden" />
            <SkeletonText className="flex-1" lines={2} widths={["38%", "64%"]} lineHeight={18} />
          </div>
          <div aria-hidden="true" className="flex-1 px-4 md:px-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn("flex gap-3 pt-5", i === 2 && "max-md:hidden")}>
                <SkeletonAvatar size={32} />
                <SkeletonText className="flex-1" lines={2} widths={["22%", i === 1 ? "54%" : "76%"]} />
              </div>
            ))}
          </div>
          {/* Phone: one row (44px field and Send). Desktop: the two-line field, then Send. */}
          <div aria-hidden="true" className="flex items-center gap-2 border-t border-divider px-4 py-3 md:block md:px-6">
            <span className="block h-11 flex-1 rounded-sm bg-hover md:h-[62px]" />
            <span className="block h-10 w-16 shrink-0 rounded-sm bg-hover md:ml-auto md:mt-2 md:h-8" />
          </div>
        </ThreadPane>
      </MessagingCard>
    </SkeletonRegion>
  );
}
