"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, Briefcase, House, MessageSquare, Search, Users, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useOutsidePointer } from "@/components/ui/floating";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { SignInMenu } from "./DemoSwitcher";
import { EmployersMenu } from "./EmployersMenu";
import { GlobalSearch } from "./GlobalSearch";
import { MeMenu } from "./MeMenu";
import { NAV_ITEM, NavIcon, NavItem } from "./NavItem";
import { navSectionFor, type DemoAccountOption, type ShellCounts, type Viewer } from "./types";

type TopNavProps = {
  viewer: Viewer | null;
  counts: ShellCounts;
  accounts: DemoAccountOption[];
  /** Render in place (not sticky, visible at every width) for the component gallery. */
  preview?: boolean;
};

/**
 * Top nav (§8.2, md and up): 52px, --surface, 1px bottom border, sticky. Brand, the search field
 * (lg) or a labelled "Search" item (md, opens a full-width search), then Home, Network, Jobs,
 * Messaging, Notifications, Me ▾, a divider and For employers. Every item is icon over label.
 */
export function TopNav({ viewer, counts, accounts, preview }: TopNavProps) {
  const pathname = usePathname();
  const section = navSectionFor(pathname, viewer);
  const [searchOpen, setSearchOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const overlayId = useId();
  const showSearch = !(pathname === "/" && !viewer);

  // Closing the tablet search overlay returns focus to the "Search" item (Esc, ×, picking a result).
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    searchButtonRef.current?.focus({ preventScroll: true });
  }, []);
  // A click outside closes it too; focus goes back to the trigger only if it would otherwise drop
  // to <body> (a click on another control keeps that control focused).
  const outsideRefs = useRef([overlayRef, searchButtonRef]).current;
  const onOutside = useCallback(() => {
    const hadFocus = !!overlayRef.current?.contains(document.activeElement);
    setSearchOpen(false);
    if (!hadFocus) return;
    requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) searchButtonRef.current?.focus({ preventScroll: true });
    });
  }, []);
  useOutsidePointer(searchOpen, outsideRefs, onOutside);

  // Tablet: "/" opens the search overlay (the inline field is hidden at 721–1080px).
  useEffect(() => {
    if (!showSearch || preview) return;
    const mq = window.matchMedia("(min-width: 721px) and (max-width: 1080px)");
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || !mq.matches) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showSearch, preview]);

  useEffect(() => setSearchOpen(false), [pathname]);

  return (
    <header className={cn("h-[var(--nav-h)] border-b border-border bg-surface", preview ? "relative min-w-[960px]" : "sticky top-0 z-30 hidden md:block")}>
      <div className="mx-auto flex h-full max-w-page items-center gap-4 px-6">
        <BrandMark href={viewer ? "/feed" : "/"} />
        {showSearch && (
          <div className="hidden lg:block">
            <GlobalSearch variant="nav" shortcut={!preview} />
          </div>
        )}
        {viewer ? (
          <nav aria-label={preview ? "Primary (preview)" : "Primary"} className="ml-auto flex h-full items-stretch">
            {showSearch && (
              <button
                ref={searchButtonRef}
                type="button"
                aria-expanded={searchOpen}
                aria-controls={searchOpen ? overlayId : undefined}
                aria-current={section === "search" ? "page" : undefined}
                onClick={() => setSearchOpen((o) => !o)}
                className={cn(NAV_ITEM, "lg:hidden")}
              >
                <NavIcon icon={Search} />
                <span>Search</span>
              </button>
            )}
            <NavItem href="/feed" label="Home" icon={House} active={section === "home"} />
            <NavItem href="/network" label="Network" icon={Users} active={section === "network"} />
            <NavItem href="/jobs" label="Jobs" icon={Briefcase} active={section === "jobs"} />
            <NavItem href="/messaging" label="Messaging" icon={MessageSquare} active={section === "messaging"} count={counts.unreadMessages} countNoun="unread" />
            <NavItem href="/notifications" label="Notifications" icon={Bell} active={section === "notifications"} count={counts.newNotifications} />
            <MeMenu viewer={viewer} accounts={accounts} variant="nav" active={section === "me"} />
            <span aria-hidden="true" className="mx-2 h-8 w-px shrink-0 self-center bg-border" />
            <EmployersMenu viewer={viewer} active={section === "employers"} />
          </nav>
        ) : (
          <div className="ml-auto flex items-center gap-1">
            {showSearch && (
              <button
                ref={searchButtonRef}
                type="button"
                aria-expanded={searchOpen}
                aria-controls={searchOpen ? overlayId : undefined}
                onClick={() => setSearchOpen((o) => !o)}
                className={cn(NAV_ITEM, "h-[var(--nav-h)] lg:hidden")}
              >
                <NavIcon icon={Search} />
                <span>Search</span>
              </button>
            )}
            <EmployersMenu viewer={null} variant="button" />
            <SignInMenu accounts={accounts} />
          </div>
        )}
      </div>

      {searchOpen && (
        <div ref={overlayRef} id={overlayId} className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface shadow-pop lg:hidden">
          <div className="mx-auto flex max-w-page items-center gap-2 px-6 py-3">
            <GlobalSearch variant="overlay" autoFocus onNavigate={closeSearch} className="flex-1" />
            <IconButton icon={X} label="Close search" onClick={closeSearch} />
          </div>
        </div>
      )}
    </header>
  );
}
