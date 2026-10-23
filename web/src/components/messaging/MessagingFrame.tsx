import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { PAGE_TITLE } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { PANE_HEADER_CLASS } from "./classes";
import { InboxSelectionProvider } from "./InboxSelection";

export { ThreadPane } from "./InboxSelection";
export { FRAME_PAGE_CLASS, FRAME_PAGE_THREAD_CLASS, PANE_HEADER_CLASS } from "./classes";

/**
 * The messaging card (§8.15): on md and up the inbox and the thread sit side by side in one card
 * split by a divider (inbox 280 at md, 320 at lg), exactly as tall as the viewport below the nav
 * minus the page's 20px top and bottom padding. On phone it is a full-bleed card that grows with
 * its content.
 */
export function MessagingCard({
  selectedId = null,
  explicit = false,
  children,
  className,
}: {
  selectedId?: string | null;
  /** The selection came from the URL (?thread=, ?to=); otherwise it is desktop's default. */
  explicit?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "md:grid md:h-[calc(100dvh-var(--nav-h)-40px)] md:min-h-[520px] md:grid-cols-[280px_minmax(0,1fr)] md:overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]",
        className,
      )}
    >
      <InboxSelectionProvider selectedId={selectedId} explicit={explicit}>
        {children}
      </InboxSelectionProvider>
    </Card>
  );
}

/**
 * Inbox column: the page's h1 and unread count, then the scrolling list. On phone it gives way to the
 * thread skeleton while a tapped conversation loads (group-data-pending, InboxSelection).
 */
export function InboxPane({ hiddenOnPhone, unread, children }: { hiddenOnPhone: boolean; unread?: number; children: ReactNode }) {
  return (
    <section
      aria-labelledby="messaging-title"
      className={cn("flex min-h-0 min-w-0 flex-col md:border-r md:border-divider", hiddenOnPhone ? "max-md:hidden" : "max-md:group-data-pending/msg:hidden")}
    >
      <div className={cn(PANE_HEADER_CLASS, "justify-between gap-3 px-4")}>
        <h1 id="messaging-title" className={PAGE_TITLE}>
          Messaging
        </h1>
        {unread ? <span className="num text-small text-fg-3">{unread.toLocaleString("en-US")} unread</span> : null}
      </div>
      <div className="min-h-0 flex-1 md:overflow-y-auto">{children}</div>
    </section>
  );
}
