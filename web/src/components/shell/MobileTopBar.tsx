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
import { navSectionFor, type DemoAccountOption, type ShellCounts, type Viewer } from "./types";

type MobileTopBarProps = {
  viewer: Viewer | null;
  counts: ShellCounts;
  accounts: DemoAccountOption[];
  /** Render in place (not sticky, visible at every width) for the component gallery. */
  preview?: boolean;
};

/**
 * Phone top bar (§8.2, ≤ 720px): 48px, sticky. Signed in: Me avatar (32 in a 44 target) · search
 * field (flex, 40px visual, 44px target, 16px text) · Messaging icon button 44 with its badge,
 * marked current on /messaging (Messaging is not in the tab bar). Visitors: the brand mark · search
 * field; Sign in lives in their tab bar, so the placeholder has room and never truncates. The
 * landing page (no tab bar, no search here) shows the full brand and a "Sign in" ghost button.
 * Side padding respects the safe-area insets (landscape on notched phones).
 */
export function MobileTopBar({ viewer, counts, accounts, preview }: MobileTopBarProps) {
  const pathname = usePathname();
  const onLanding = !viewer && (pathname.replace(/\/+$/, "") || "/") === "/";
  const messagingActive = navSectionFor(pathname, viewer) === "messaging";
  return (
    <header
      className={cn(
        "flex h-[var(--mtop-h)] items-center gap-2 border-b border-border bg-surface pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))]",
        preview ? "relative" : "sticky top-0 z-30 md:hidden",
      )}
    >
      {viewer ? (
        <MeMenu viewer={viewer} accounts={accounts} variant="mobile" />
      ) : (
        <BrandMark href="/" variant={onLanding ? "full" : "mark"} className="h-11 min-w-11 justify-center px-2.5" />
      )}
      {onLanding ? <span className="flex-1" /> : <GlobalSearch variant="mobile" shortcut={!preview} />}
      {viewer ? (
        <Tooltip content="Messaging">
          <Link
            href="/messaging"
            aria-label={withCount("Messaging", counts.unreadMessages, "unread")}
            aria-current={messagingActive ? "page" : undefined}
            className="relative grid size-11 shrink-0 place-items-center rounded-sm text-fg-2 transition-colors hover:bg-hover hover:text-fg-1 aria-[current=page]:text-fg-1"
          >
            <Icon icon={MessageSquare} size={22} strokeWidth={messagingActive ? 2.1 : undefined} />
            <CountBadge count={counts.unreadMessages} className="left-6 top-1" />
          </Link>
        </Tooltip>
      ) : (
        onLanding && <SignInMenu accounts={accounts} variant="compact" />
      )}
    </header>
  );
}
