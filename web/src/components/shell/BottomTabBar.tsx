"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Bell, Briefcase, House, Users, type LucideIcon } from "lucide-react";
import { CountBadge, withCount } from "@/components/ui/CountBadge";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { MeMenu } from "./MeMenu";
import { navSectionFor, type DemoAccountOption, type NavSection, type ShellCounts, type Viewer } from "./types";

type BottomTabBarProps = {
  viewer: Viewer;
  counts: ShellCounts;
  accounts: DemoAccountOption[];
  /** Render in place (not fixed, visible at every width) for the component gallery. */
  preview?: boolean;
};

const TAB =
  "relative flex min-w-0 flex-col items-center justify-center gap-[3px] whitespace-nowrap text-caption font-medium tracking-[-0.01em] text-fg-2 focus-visible:-outline-offset-2 " +
  "aria-[current=page]:font-semibold aria-[current=page]:text-fg-1";

function Tab({ href, label, icon, active, count = 0 }: { href: string; label: string; icon: LucideIcon; active: boolean; count?: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} aria-label={count > 0 ? withCount(label, count) : undefined} className={TAB}>
      <span className="relative grid">
        <Icon icon={icon} size={22} strokeWidth={active ? 2.1 : undefined} />
        <CountBadge count={count} className="-top-[5px] left-3.5" />
      </span>
      <span>{label}</span>
    </Link>
  );
}

/**
 * Phone tab bar (§8.2, ≤ 720px): fixed, 56px + safe area, five equal cells (Home · Network · Jobs ·
 * Notifications · Me), icon 22 over a 12/500 label; active --fg-1, 600, 2.1 stroke (no pill).
 *
 * Capture aid (§10): under an automated browser (navigator.webdriver) and unless the URL hash
 * contains "fold", <html> gets class "capture-full", which pins the bar to the end of the document
 * so full-page screenshots don't draw it mid-page. Real users are unaffected.
 */
export function BottomTabBar({ viewer, counts, accounts, preview }: BottomTabBarProps) {
  const pathname = usePathname();
  const section: NavSection | null = navSectionFor(pathname, viewer);

  useEffect(() => {
    if (preview) return;
    const el = document.documentElement;
    const apply = () => el.classList.toggle("capture-full", navigator.webdriver === true && !location.hash.includes("fold"));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [preview]);

  return (
    <nav
      aria-label={preview ? "Primary (preview)" : "Primary"}
      data-tabbar={preview ? undefined : ""}
      className={cn(
        "grid grid-cols-5 border-t border-border bg-surface",
        preview ? "relative h-[var(--tabbar-h)]" : "fixed inset-x-0 bottom-0 z-30 h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] md:hidden",
      )}
    >
      <Tab href="/feed" label="Home" icon={House} active={section === "home"} />
      <Tab href="/network" label="Network" icon={Users} active={section === "network"} />
      <Tab href="/jobs" label="Jobs" icon={Briefcase} active={section === "jobs"} />
      <Tab href="/notifications" label="Notifications" icon={Bell} active={section === "notifications"} count={counts.newNotifications} />
      <MeMenu viewer={viewer} accounts={accounts} variant="tab" active={section === "me"} />
    </nav>
  );
}
