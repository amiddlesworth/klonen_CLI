import Link from "next/link";
import { ChevronLeft, Info } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Participant } from "@/lib/queries/messaging";
import { PANE_HEADER_CLASS } from "./MessagingFrame";
import { ThreadMenu } from "./ThreadMenu";

/** The parts of a participant the header shows (a new-message target has no account yet). */
export type HeaderPerson = Omit<Participant, "userId">;

/**
 * "Defensive Backs Coach at U.S. Merchant Marine Academy". The program is linked when it has a page,
 * except for fictional demo people: program pages list real staff only, so the link would contradict
 * the demo. On md and up the link's 24px target fits inside the line's own padding (the line
 * truncates). On phone the compact header shows plain text: a truncated line there often cuts the
 * program off entirely, which would leave an invisible, focusable link (the name links the profile).
 */
export function Headline({ other }: { other: HeaderPerson }) {
  const org = other.orgName ? (
    other.orgInRegistry && other.orgSlug && !other.fictional ? (
      <>
        <Link href={`/programs/${other.orgSlug}`} className="py-1.5 font-medium underline-offset-2 hover:text-fg-1 hover:underline max-md:hidden">
          {other.orgName}
        </Link>
        <span className="font-medium md:hidden">{other.orgName}</span>
      </>
    ) : (
      <span className="font-medium">{other.orgName}</span>
    )
  ) : null;
  if (other.title && org) {
    return (
      <>
        {other.title} at {org}
      </>
    );
  }
  return <>{other.title ?? org}</>;
}

type ThreadHeaderProps = {
  /** The conversation (null on a new-message pane: no "Mark as unread"). */
  threadId: string | null;
  other: HeaderPerson;
  isDemo: boolean;
};

/**
 * Thread header (§8.15), 64px on md and up (56 on phone) like the inbox header beside it: a labeled
 * "Messaging" back link (phone), avatar (40, 32 on phone), name 14/600 linked to the profile, the Demo
 * chip, "title at program" 12 --fg-2, and More. On md and up it shares the thread column's 24px left
 * edge with the messages and the composer.
 */
export function ThreadHeader({ threadId, other, isDemo }: ThreadHeaderProps) {
  const name = other.profileSlug ? (
    <Link href={`/in/${other.profileSlug}`} className="target-24 truncate underline-offset-2 hover:underline">
      {other.name}
    </Link>
  ) : (
    <span className="truncate">{other.name}</span>
  );
  return (
    <header className={cn(PANE_HEADER_CLASS, "z-10 gap-2 bg-surface pl-1 pr-2 max-md:sticky max-md:top-[var(--mtop-h)] md:gap-3 md:px-6")}>
      <Link
        href="/messaging"
        className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-sm pl-1 pr-2 text-small font-medium text-fg-2 underline-offset-2 hover:text-fg-1 hover:underline md:hidden"
      >
        <Icon icon={ChevronLeft} size={16} />
        Messaging
      </Link>
      <Avatar name={other.name} tintKey={other.tintKey} size={40} className="max-md:size-8 max-md:text-[11px]" />
      <div className="min-w-0 flex-1">
        <h2 id="thread-title" className="flex min-w-0 items-center gap-2 text-body font-semibold text-fg-1">
          {name}
          {isDemo && <SampleChip label="Demo" className="shrink-0" />}
        </h2>
        {(other.title || other.orgName) && (
          <p className="-my-1.5 truncate py-1.5 text-caption text-fg-2">
            <Headline other={other} />
          </p>
        )}
      </div>
      <ThreadMenu threadId={threadId} profileSlug={other.profileSlug} />
    </header>
  );
}

/**
 * The first line of a demo conversation: says in words that it is demo data (the header carries the
 * chip). Who the conversation is with is already in the header right above.
 */
export function DemoNote({ other }: { other: HeaderPerson }) {
  return (
    <p className="flex items-start gap-1.5 pt-4 text-caption text-fg-3">
      <Icon icon={Info} size={12} className="mt-0.5 shrink-0 text-fg-2" />
      <span>
        {other.fictional
          ? `Demo conversation. ${other.firstName} is a fictional account, and these messages are sample data.`
          : "Demo conversation. These messages are sample data written for the demo, not real correspondence."}
      </span>
    </p>
  );
}
