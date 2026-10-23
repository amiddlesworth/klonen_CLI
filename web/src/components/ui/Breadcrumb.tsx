import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type Crumb = { label: string; href?: string };

/**
 * The breadcrumb row's box (audit X11), applied by the page layouts around their `breadcrumb` slot:
 * from md, a fixed 32px row that starts 8px into the page's top padding (64–96px under the nav), so
 * the first card below it sits at the same height on every sub-page (profile, tree, job, claim,
 * post a job, settings), whatever the crumbs' text. On phone the slot is a plain block.
 */
export const BREADCRUMB_ROW = "md:-mt-2 md:flex md:h-8 md:min-w-0 md:items-center";

type BreadcrumbProps = {
  /** Ancestors, top-down; each a real parent page. */
  items: Crumb[];
  /** The current page (--fg-1, aria-current="page"). */
  current: string;
  /**
   * Phone (≤ 720px): "hidden" (default; detail pages, §8.4) or "back": a "‹ {parent}" link with a
   * 44px target, for flows with no tab-bar destination to return to (claim, post a job, settings).
   */
  phone?: "hidden" | "back";
  className?: string;
};

const LINK = "inline-flex min-h-6 items-center rounded-xs underline-offset-2 hover:text-fg-1 hover:underline";

/**
 * Breadcrumb (§8.4, audit X11): "{Parent} › {Parent} › {Current}", 13px --fg-2, 14px --fg-3
 * chevrons, the current page --fg-1 with aria-current="page". Pass it to a layout's `breadcrumb`
 * slot, which puts it in the fixed 32px BREADCRUMB_ROW.
 * Top-level destinations (Jobs, Search, Messaging, Notifications, Hiring pipeline, Settings) have
 * none; every page below them has one.
 */
export function Breadcrumb({ items, current, phone = "hidden", className }: BreadcrumbProps) {
  const parent = [...items].reverse().find((c) => c.href);
  return (
    <>
      <nav aria-label="Breadcrumb" className={cn("min-w-0 max-md:hidden", className)}>
        <ol className="flex min-w-0 items-center gap-1 text-small leading-6 text-fg-2">
          {items.map((c) => (
            <li key={`${c.label}-${c.href ?? ""}`} className="flex shrink-0 items-center gap-1">
              {c.href ? (
                <Link href={c.href} className={LINK}>
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
              <Icon icon={ChevronRight} size={14} className="text-fg-3" />
            </li>
          ))}
          <li className="min-w-0 truncate">
            <span aria-current="page" className="text-fg-1">
              {current}
            </span>
          </li>
        </ol>
      </nav>
      {phone === "back" && parent?.href && (
        <nav aria-label="Breadcrumb" className={cn("flex h-11 items-center px-2 md:hidden", className)}>
          <Link href={parent.href} className="inline-flex h-11 items-center gap-0.5 rounded-sm px-2 text-small text-fg-2 underline-offset-2 hover:text-fg-1 hover:underline">
            <Icon icon={ChevronLeft} size={16} />
            {parent.label}
          </Link>
        </nav>
      )}
    </>
  );
}
