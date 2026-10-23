import { SkeletonAvatar, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";
import { InboxPane, MessagingCard, ThreadPane } from "./MessagingFrame";
import { ThreadSkeleton } from "./ThreadSkeleton";

type MessagingSkeletonProps = {
  /**
   * What the phone shows while loading: the inbox (/messaging); a conversation page (?thread=, ?to=)
   * with its back link, two messages and the one-row composer on the tab bar; or, while the URL being
   * loaded isn't known yet, a neutral card (a header row only) that either can replace without a jump.
   * Desktop always shows both panes.
   */
  phone?: "inbox" | "thread" | "neutral";
};

/** Inbox and thread skeleton (§8.0): real card chrome and h1, three inbox rows, a thread header and three messages. */
export function MessagingSkeleton({ phone = "inbox" }: MessagingSkeletonProps) {
  return (
    <SkeletonRegion label={phone === "thread" ? "Loading conversation" : "Loading messages"}>
      <MessagingCard>
        <InboxPane hiddenOnPhone={phone !== "inbox"}>
          <ul aria-hidden="true" className="divide-y divide-divider">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <SkeletonAvatar size={40} />
                <SkeletonText className="flex-1" lines={2} widths={[i % 2 ? "48%" : "60%", i % 2 ? "82%" : "70%"]} lineHeight={18} />
              </li>
            ))}
          </ul>
        </InboxPane>
        <ThreadPane threadId={null} hiddenOnPhone={phone === "inbox"} fillOnPhone={phone === "thread"} label="Loading conversation">
          <ThreadSkeleton backLink={phone === "thread"} headerOnlyOnPhone={phone === "neutral"} />
        </ThreadPane>
      </MessagingCard>
    </SkeletonRegion>
  );
}
