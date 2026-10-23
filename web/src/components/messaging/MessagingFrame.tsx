import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { InboxSelectionProvider } from "./InboxSelection";

export { ThreadPane } from "./InboxSelection";

/**
 * The page wrapper for the messaging card. On md and up the page itself never scrolls: no legal
 * footer, 20px above and below the card, and the card fills the rest of the viewport (each pane
 * scrolls on its own). On phone the inbox page keeps the legal footer under the card; the thread page
 * has none, and no bottom padding, so its composer sits directly on the tab bar.
 */
export const FRAME_PAGE_CLASS = "md:pb-5 md:[&>footer]:hidden";
export const FRAME_PAGE_THREAD_CLASS = "max-md:pb-0";

/**
 * The messaging card (§8.15): on md and up the inbox and the thread sit side by side in one card
 * split by a divider (inbox 280 at md, 320 at lg), exactly as tall as the viewport below the nav
 * minus the page's 20px top and bottom padding. On phone it is a full-bleed card that grows with
 * its content.
 */
export function MessagingCard({ selectedId = null, children, className }: { selectedId?: string | null; children: ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        "md:grid md:h-[calc(100dvh-var(--nav-h)-40px)] md:min-h-[520px] md:grid-cols-[280px_minmax(0,1fr)] md:overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]",
        className,
      )}
    >
      <InboxSelectionProvider selectedId={selectedId}>{children}</InboxSelectionProvider>
    </Card>
  );
}

/**
 * Both pane headers are 64px tall on md and up, border included, so their bottom rules form one
 * line across the card (56px on phone, where only one pane shows).
 */
export const PANE_HEADER_CLASS = "flex h-14 shrink-0 items-center border-b border-divider md:h-16";

/** Inbox column: the page's h1 and unread count, then the scrolling list. */
export function InboxPane({ hiddenOnPhone, unread, children }: { hiddenOnPhone: boolean; unread?: number; children: ReactNode }) {
  return (
    <section aria-labelledby="messaging-title" className={cn("flex min-h-0 min-w-0 flex-col md:border-r md:border-divider", hiddenOnPhone && "max-md:hidden")}>
      <div className={cn(PANE_HEADER_CLASS, "justify-between gap-3 px-4")}>
        <h1 id="messaging-title" className="text-title">
          Messaging
        </h1>
        {unread ? <span className="num text-small text-fg-3">{unread} unread</span> : null}
      </div>
      <div className="min-h-0 flex-1 md:overflow-y-auto">{children}</div>
    </section>
  );
}
