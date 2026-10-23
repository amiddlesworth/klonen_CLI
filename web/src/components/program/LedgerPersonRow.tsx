import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SampleChip, UnclaimedChip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";

type LedgerPersonRowProps = {
  person: { slug: string; fullName: string; claimed: boolean; isDemo: boolean };
  /** 13px --fg-2 line under the name (title, or role here). */
  line?: ReactNode;
  /** ContextLine under that ("Now Head Coach at Linfield"). */
  context?: ReactNode;
  /** Season ledger on the right (desktop) or under the text (phone). */
  ledger?: ReactNode;
  className?: string;
};

/**
 * A person in a program list (§8.6): avatar 40, name 14/600 with Unclaimed / Demo chips, a 13px line,
 * optional context, and the season range in a right-aligned 128px ledger column (under the text on
 * phone). The whole row is one link to the profile, at least 44px tall; hover underlines the name.
 */
export function LedgerPersonRow({ person, line, context, ledger, className }: LedgerPersonRowProps) {
  return (
    <Link href={`/in/${person.slug}`} className={cn("group/row flex min-h-11 min-w-0 items-start gap-3 rounded-xs focus-visible:outline-offset-4", className)}>
      <Avatar name={person.fullName} tintKey={person.slug} size={40} />
      {/* Phone order: name, line, range (right after the title, §8.4), context. md+: range in a right column. */}
      <div className="grid min-w-0 flex-1 grid-cols-1 items-start md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 md:col-start-1">
          <span className="text-body font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{person.fullName}</span>
          {person.isDemo ? <SampleChip /> : !person.claimed && <UnclaimedChip />}
        </p>
        {line && <p className="text-small text-fg-2 md:col-start-1">{line}</p>}
        {ledger && <div className="mt-0.5 md:col-start-2 md:row-span-3 md:row-start-1 md:mt-0">{ledger}</div>}
        {context && <div className="md:col-start-1">{context}</div>}
      </div>
    </Link>
  );
}

/** "Start year not in source" in the ledger column (§8.6). */
export function LedgerUndated({ children = "Start year not in source" }: { children?: ReactNode }) {
  return <span className="block whitespace-nowrap text-caption leading-5 text-fg-3 md:min-w-32 md:text-right">{children}</span>;
}
