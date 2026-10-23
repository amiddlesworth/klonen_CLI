"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { CountBadge, withCount } from "@/components/ui/CountBadge";
import { Icon } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { SignInMenu } from "./DemoSwitcher";
import { GlobalSearch } from "./GlobalSearch";
import { MeMenu } from "./MeMenu";
import type { DemoAccountOption, ShellCounts, Viewer } from "./types";

type MobileTopBarProps = {
  viewer: Viewer | null;
  counts: ShellCounts;
  accounts: DemoAccountOption[];
  /** Render in place (not sticky, visible at every width) for the component gallery. */
  preview?: boolean;
};

/**
 * Phone top bar (§8.2, ≤ 720px): 48px, sticky. Me avatar (32 in a 44 target) · search field
 * (flex, 40px visual, 44px target, 16px text) · Messaging icon button 44 with its badge.
 */
export function MobileTopBar({ viewer, counts, accounts, preview }: MobileTopBarProps) {
  const pathname = usePathname();
  const showSearch = !(pathname === "/" && !viewer);
  return (
    <header className={cn("flex h-[var(--mtop-h)] items-center gap-2 border-b border-border bg-surface px-2", preview ? "relative" : "sticky top-0 z-30 md:hidden")}>
      {viewer ? (
        <MeMenu viewer={viewer} accounts={accounts} variant="mobile" />
      ) : (
        <BrandMark href="/" variant={showSearch ? "mark" : "full"} className="h-11 min-w-11 justify-center px-2.5" />
      )}
      {showSearch ? <GlobalSearch variant="mobile" shortcut={!preview} /> : <span className="flex-1" />}
      {viewer ? (
        <Tooltip content="Messaging">
          <Link
            href="/messaging"
            aria-label={withCount("Messaging", counts.unreadMessages, "unread")}
            className="relative grid size-11 shrink-0 place-items-center rounded-sm text-fg-2 transition-colors hover:bg-hover hover:text-fg-1"
          >
            <Icon icon={MessageSquare} size={22} />
            <CountBadge count={counts.unreadMessages} className="left-6 top-1" />
          </Link>
        </Tooltip>
      ) : (
        <SignInMenu accounts={accounts} compact />
      )}
    </header>
  );
}
