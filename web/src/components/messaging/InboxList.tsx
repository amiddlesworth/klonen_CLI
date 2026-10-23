import { Avatar } from "@/components/ui/Avatar";
import { SampleChip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import type { ThreadSummary } from "@/lib/queries/messaging";
import { threadHref } from "./format";
import { InboxRowLink } from "./InboxSelection";
import { LocalTime } from "./LocalTime";

type InboxListProps = {
  threads: ThreadSummary[];
  /** The open thread (explicit ?thread=, or the newest one on desktop). */
  selectedId: string | null;
  /** True when the selection came from the URL; an implicit desktop selection isn't shown on phone. */
  explicit: boolean;
  now: Date;
  className?: string;
};

/**
 * Inbox (§8.15): 64px rows, avatar 40, name 13/600 with the Demo chip, a one-line snippet 12 --fg-2
 * and the time 12 --fg-3. Unread rows have a 600 snippet and an 8px ink dot; the open row is --hover
 * (and a clicked row takes that look at once, while its thread loads).
 */
export function InboxList({ threads, selectedId, explicit, now, className }: InboxListProps) {
  return (
    <ul aria-label="Conversations" className={cn("divide-y divide-divider", className)}>
      {threads.map((t) => {
        const selected = t.id === selectedId;
        const unread = t.unread > 0;
        const snippet = t.last.fromMe ? `You: ${t.last.body}` : t.last.body;
        return (
          <li key={t.id}>
            <InboxRowLink
              threadId={t.id}
              href={threadHref(t.id)}
              selected={selected}
              explicit={explicit}
              className="relative flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-hover focus-visible:-outline-offset-2"
            >
              <Avatar name={t.other.name} tintKey={t.other.tintKey} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-small font-semibold text-fg-1">{t.other.name}</span>
                  {t.isDemo && <SampleChip label="Demo" />}
                  <LocalTime iso={t.last.sentAt.toISOString()} className="num ml-auto shrink-0 text-caption text-fg-3">
                    {timeAgo(t.last.sentAt, now)}
                    <span className="sr-only"> ago</span>
                  </LocalTime>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className={cn("min-w-0 truncate text-caption", unread ? "font-semibold text-fg-1" : "text-fg-2")}>{snippet}</span>
                  {unread && <span aria-hidden="true" className="ml-auto size-2 shrink-0 rounded-full bg-fg-1" />}
                </span>
                {unread && <span className="sr-only">{`, ${t.unread} unread`}</span>}
              </span>
            </InboxRowLink>
          </li>
        );
      })}
    </ul>
  );
}
