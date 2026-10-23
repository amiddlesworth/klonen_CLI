import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { LegalFooter } from "./LegalFooter";
import { StickyAside } from "./StickyAside";

type RightRailProps = {
  /** Accessible name of the aside ("Carousel and suggestions"). */
  label: string;
  children?: ReactNode;
  /** End with the legal footer (default true). */
  footer?: boolean;
  /** Gap below the nav when the rail is pinned (px; see StickyAside). */
  stickyOffset?: number;
  className?: string;
};

/**
 * Right rail (§8.2): a stack of rail cards (16px padding) with 12px gaps (8px on phone), then the
 * legal footer. Layout helpers make it sticky 16–20px below the nav, and StickyAside keeps a rail
 * taller than the viewport reachable (it pins at its bottom instead of its top).
 */
export function RightRail({ label, children, footer = true, stickyOffset, className }: RightRailProps) {
  return (
    <StickyAside aria-label={label} offset={stickyOffset} className={cn("flex min-w-0 flex-col gap-2 md:gap-3", className)}>
      {children}
      {footer && <LegalFooter className="md:max-[961px]:col-span-full" />}
    </StickyAside>
  );
}
