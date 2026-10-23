import Link from "next/link";
import { ChevronLeft, Info } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { IconLink } from "@/components/ui/IconButton";
import type { Participant } from "@/lib/queries/messaging";
import { ThreadMenu } from "./ThreadMenu";

/** "Defensive Backs Coach at U.S. Merchant Marine Academy", with the program linked when it has a page. */
export function Headline({ other }: { other: Participant }) {
  const org = other.orgName ? (
    other.orgInRegistry && other.orgSlug ? (
      <Link href={`/programs/${other.orgSlug}`} className="font-medium underline-offset-2 hover:text-fg-1 hover:underline">
        {other.orgName}
      </Link>
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

/**
 * Thread header (§8.15): back to the inbox (phone), avatar 40, name 14/600 (linked to the profile),
 * the Demo chip, "title at program" 12 --fg-2, and More.
 */
export function ThreadHeader({ threadId, other, isDemo }: { threadId: string; other: Participant; isDemo: boolean }) {
  const name = other.profileSlug ? (
    <Link href={`/in/${other.profileSlug}`} className="target-24 truncate underline-offset-2 hover:underline">
      {other.name}
    </Link>
  ) : (
    <span className="truncate">{other.name}</span>
  );
  return (
    <header className="z-10 flex min-h-16 items-center gap-3 border-b border-divider bg-surface py-3 pl-1 pr-2 max-md:sticky max-md:top-[var(--mtop-h)] md:px-4 md:pr-3">
      <IconLink href="/messaging" icon={ChevronLeft} label="Back to Messaging" phone="large" className="md:hidden" wrapperClassName="md:hidden" />
      <Avatar name={other.name} tintKey={other.tintKey} size={40} />
      <div className="min-w-0 flex-1">
        <h2 id="thread-title" className="flex min-w-0 items-center gap-2 text-body font-semibold text-fg-1">
          {name}
          {isDemo && <SampleChip label="Demo" />}
        </h2>
        {(other.title || other.orgName) && (
          <p className="truncate text-caption text-fg-2">
            <Headline other={other} />
          </p>
        )}
      </div>
      <ThreadMenu threadId={threadId} profileSlug={other.profileSlug} />
    </header>
  );
}

/**
 * The start of a conversation: who it is with (avatar 56, name, headline) and the demo note, so a
 * demo thread says what it is in words, not only with the chip.
 */
export function ThreadIntro({ other, isDemo }: { other: Participant; isDemo: boolean }) {
  return (
    <div className="flex flex-col items-start gap-0.5 border-b border-divider pb-4 pt-5">
      <Avatar name={other.name} tintKey={other.tintKey} size={56} className="mb-2" />
      <p className="text-subtitle font-semibold text-fg-1">
        {other.profileSlug ? (
          <Link href={`/in/${other.profileSlug}`} className="target-24 underline-offset-2 hover:underline">
            {other.name}
          </Link>
        ) : (
          other.name
        )}
      </p>
      {(other.title || other.orgName) && (
        <p className="text-small text-fg-2">
          <Headline other={other} />
        </p>
      )}
      {isDemo && (
        <p className="mt-2 flex items-start gap-1.5 text-caption text-fg-3">
          <Icon icon={Info} size={12} className="mt-0.5 text-fg-2" />
          <span>
            {other.fictional
              ? `Demo conversation. ${other.firstName} is a fictional account, and these messages are sample data.`
              : "Demo conversation. These messages are sample data written for the demo, not real correspondence."}
          </span>
        </p>
      )}
    </div>
  );
}
