"use client";
import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  href: string;
  label: string;
  /** Optional count shown in --fg-3 after the label. */
  count?: number | null;
  active?: boolean;
};

type TabsProps = {
  items: TabItem[];
  /** Accessible name of the tab list ("Program sections"). */
  label: string;
  className?: string;
};

/**
 * Page tabs (§8.1) whose tabs are URLs (?tab=): links styled as tabs, in a role="tablist" with
 * arrow-key roving focus. 44px tall, 13/500 --fg-2; active --fg-1 with a 2px ink underline
 * flush with the divider below.
 */
export function Tabs({ items, label, className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, items.findIndex((t) => t.active));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') ?? []);
    const i = tabs.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    tabs.forEach((t, j) => (t.tabIndex = j === next ? 0 : -1));
    tabs[next].focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex overflow-x-auto border-b border-divider [scrollbar-width:none]", className)}
    >
      {items.map((t, i) => (
        <Link
          key={t.href}
          href={t.href}
          role="tab"
          aria-selected={i === activeIndex}
          tabIndex={i === activeIndex ? 0 : -1}
          scroll={false}
          className={cn(
            "relative -mb-px inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-none px-4 text-small font-medium transition-colors focus-visible:-outline-offset-2",
            i === activeIndex
              ? "text-fg-1 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-fg-1"
              : "text-fg-2 hover:text-fg-1",
          )}
        >
          {t.label}
          {t.count != null && <span className="num font-normal text-fg-3">{t.count.toLocaleString("en-US")}</span>}
        </Link>
      ))}
    </div>
  );
}
