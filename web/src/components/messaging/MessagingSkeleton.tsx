import { InboxPane, MessagingCard, ThreadPane } from "@/components/messaging/MessagingFrame";
import { SkeletonAvatar, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";

/** Inbox and thread skeleton (§8.0): real card chrome and h1, three inbox rows, a thread header and three messages. */
export function MessagingSkeleton() {
  return (
    <SkeletonRegion label="Loading messages">
      <MessagingCard>
        <InboxPane hiddenOnPhone={false}>
          <ul aria-hidden="true" className="divide-y divide-divider">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <SkeletonAvatar size={40} />
                <SkeletonText className="flex-1" lines={2} widths={[i % 2 ? "48%" : "60%", i % 2 ? "82%" : "70%"]} lineHeight={18} />
              </li>
            ))}
          </ul>
        </InboxPane>
        <ThreadPane hiddenOnPhone label="Loading conversation">
          <div aria-hidden="true" className="flex min-h-16 items-center gap-3 border-b border-divider px-4 py-3">
            <SkeletonAvatar size={40} />
            <SkeletonText className="flex-1" lines={2} widths={["28%", "44%"]} lineHeight={18} />
          </div>
          <div aria-hidden="true" className="flex-1 px-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 pt-5">
                <SkeletonAvatar size={32} />
                <SkeletonText className="flex-1" lines={2} widths={["22%", i === 1 ? "54%" : "76%"]} />
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="border-t border-divider px-6 py-3">
            <span className="block h-[62px] rounded-sm bg-hover" />
            <span className="mt-2 ml-auto block h-8 w-16 rounded-sm bg-hover" />
          </div>
        </ThreadPane>
      </MessagingCard>
    </SkeletonRegion>
  );
}
