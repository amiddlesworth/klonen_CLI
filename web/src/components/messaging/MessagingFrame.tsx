import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/**
 * The messaging card (§8.15): on md and up the inbox and the thread sit side by side in one card
 * split by a divider (inbox 280 at md, 320 at lg), filling the viewport below the nav so each pane
 * scrolls on its own. On phone it is a full-bleed card that grows with its content.
 */
export function MessagingCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        "md:grid md:h-[calc(100dvh-var(--nav-h)-40px)] md:min-h-[520px] md:grid-cols-[280px_minmax(0,1fr)] md:overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]",
        className,
      )}
    >
      {children}
    </Card>
  );
}

/** Inbox column: the page's h1 and unread count, then the scrolling list. */
export function InboxPane({ hiddenOnPhone, unread, children }: { hiddenOnPhone: boolean; unread?: number; children: ReactNode }) {
  return (
    <section aria-labelledby="messaging-title" className={cn("flex min-h-0 min-w-0 flex-col md:border-r md:border-divider", hiddenOnPhone && "max-md:hidden")}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-divider px-4">
        <h1 id="messaging-title" className="text-title">
          Messaging
        </h1>
        {unread ? <span className="num text-small text-fg-3">{unread} unread</span> : null}
      </div>
      <div className="min-h-0 flex-1 md:overflow-y-auto">{children}</div>
    </section>
  );
}

/** Thread column: header, messages (scrolling on md and up) and the composer. */
export function ThreadPane({ hiddenOnPhone, label, children }: { hiddenOnPhone: boolean; label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className={cn("flex min-h-0 min-w-0 flex-col", hiddenOnPhone && "max-md:hidden")}>
      {children}
    </section>
  );
}
