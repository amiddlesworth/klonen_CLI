"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Bell, Briefcase, House, Search, Users, type LucideIcon } from "lucide-react";
import { CountBadge, withCount } from "@/components/ui/CountBadge";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { SignInMenu } from "./DemoSwitcher";
import { MeMenu } from "./MeMenu";
import { TAB_CELL } from "./NavItem";
import { hasTabBar, navSectionFor, type DemoAccountOption, type NavSection, type ShellCounts, type Viewer } from "./types";

type BottomTabBarProps = {
  /** Signed in: Home · Network · Jobs · Notifications · Me. Signed out (null): Home · Search · Jobs · Sign in. */
  viewer: Viewer | null;
  counts: ShellCounts;
  accounts: DemoAccountOption[];
  /** Render in place (not fixed, visible at every width) for the component gallery. */
  preview?: boolean;
};

function Tab({ href, label, icon, active, count = 0 }: { href: string; label: string; icon: LucideIcon; active: boolean; count?: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} aria-label={count > 0 ? withCount(label, count) : undefined} className={TAB_CELL}>
      <span className="relative grid">
        <Icon icon={icon} size={22} strokeWidth={active ? 2.1 : undefined} />
        <CountBadge count={count} className="-top-[5px] left-3.5" />
      </span>
      <span>{label}</span>
    </Link>
  );
}

/**
 * Phone tab bar (§8.2, ≤ 720px): fixed, 56px + safe area, equal cells, icon 22 over a 12/500 label;
 * active --fg-1, 600, 2.1 stroke (no pill). Signed in: five cells (Home · Network · Jobs ·
 * Notifications · Me). Visitors get the public destinations: Home (the landing page) · Search ·
 * Jobs · Sign in (the demo account sheet, which also holds the For employers links). On
 * /notifications the Notifications badge reads 0: opening the page clears it (MarkNotificationsSeen). The landing
 * page itself has no tab bar (§8.10), so the bar renders nothing there.
 *
 * Capture aid (§10): under an automated browser (navigator.webdriver) and unless the URL hash
 * contains "fold", <html> gets class "capture-full", which pins the bar to the end of the document
 * so full-page screenshots don't draw it mid-page. Real users are unaffected.
 */
export function BottomTabBar({ viewer, counts, accounts, preview }: BottomTabBarProps) {
  const pathname = usePathname();
  const section: NavSection | null = navSectionFor(pathname, viewer);
  const shown = preview || hasTabBar(pathname, !!viewer);

  useEffect(() => {
    if (preview || !shown) return;
    const el = document.documentElement;
    const apply = () => el.classList.toggle("capture-full", navigator.webdriver === true && !location.hash.includes("fold"));
    apply();
    window.addEventListener("hashchange", apply);
    return () => {
      window.removeEventListener("hashchange", apply);
      el.classList.remove("capture-full");
    };
  }, [preview, shown]);

  if (!shown) return null;
  return (
    <nav
      aria-label={preview ? "Primary (preview)" : "Primary"}
      data-tabbar={preview ? undefined : ""}
      className={cn(
        "grid border-t border-border bg-surface px-[env(safe-area-inset-left)_env(safe-area-inset-right)]",
        viewer ? "grid-cols-5" : "grid-cols-4",
        preview ? "relative h-[var(--tabbar-h)]" : "fixed inset-x-0 bottom-0 z-30 h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] md:hidden",
      )}
    >
      {viewer ? (
        <>
          <Tab href="/feed" label="Home" icon={House} active={section === "home"} />
          <Tab href="/network" label="Network" icon={Users} active={section === "network"} />
          <Tab href="/jobs" label="Jobs" icon={Briefcase} active={section === "jobs"} />
          <Tab href="/notifications" label="Notifications" icon={Bell} active={section === "notifications"} count={section === "notifications" ? 0 : counts.newNotifications} />
          <MeMenu viewer={viewer} accounts={accounts} variant="tab" active={section === "me"} />
        </>
      ) : (
        <>
          <Tab href="/" label="Home" icon={House} active={section === "landing"} />
          <Tab href="/search" label="Search" icon={Search} active={section === "search"} />
          <Tab href="/jobs" label="Jobs" icon={Briefcase} active={section === "jobs"} />
          <SignInMenu accounts={accounts} variant="tab" />
        </>
      )}
    </nav>
  );
}
