import type { ReactNode } from "react";
import { BREADCRUMB_ROW } from "@/components/ui/Breadcrumb";
import { cn } from "@/lib/cn";
import { LegalFooter } from "./LegalFooter";
import { RightRail } from "./RightRail";
import { StickyAside } from "./StickyAside";

/*
 * Page layouts (§8.2 AppShell grid). Container: max 1200px with 24px side padding (1152 content;
 * `page-x`, which also respects the safe-area insets in landscape),
 * centered; page padding top 20 in every layout (so the first card never jumps between tabs), bottom 48. Phone: one column, full-bleed cards, no side padding
 * (content that is not a card brings its own 16px gutter) and an 8px canvas gap under the top bar
 * (the phone card gap, §5.1). Each layout renders the page's single <main id="main"> (the skip link
 * target); rails are labelled <aside>s.
 *
 * Sub-pages pass a `breadcrumb` (ui/Breadcrumb): every layout puts it in the same fixed 32px row
 * (BREADCRUMB_ROW) with a 12px gap below, so first cards line up across sibling sub-pages.
 *
 * Sticky rails pin only when they fit: StickyAside sets --rail-top so a rail taller than the
 * viewport scrolls until its end (the legal footer) is visible, then pins there.
 */

const MAIN = "flex min-w-0 flex-col gap-2 outline-none md:gap-3";
const STICKY = "md:sticky md:top-[var(--rail-top,calc(var(--nav-h)+20px))]";

/** Generic page body: one column at full page width. */
export function PageContainer({ children, footer = true, breadcrumb, className }: { children: ReactNode; footer?: boolean; breadcrumb?: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-page pb-4 pt-2 page-x md:pb-12 md:pt-5", className)}>
      {breadcrumb && <div className={cn(BREADCRUMB_ROW, "md:mb-3")}>{breadcrumb}</div>}
      <main id="main" tabIndex={-1} className={MAIN}>
        {children}
      </main>
      {footer && <LegalFooter className="mt-4 md:mt-6" />}
    </div>
  );
}

type ThreeColumnProps = {
  /** Left rail (lg only; at md it moves into the Me menu, on phone it is dropped). */
  left?: ReactNode;
  leftLabel?: string;
  /** Right rail cards; the legal footer is appended. */
  right?: ReactNode;
  rightLabel?: string;
  /** Hide the right rail on phone (the feed shows a summary card instead). */
  hideRightOnPhone?: boolean;
  children: ReactNode;
};

/** Feed grid: lg `232 · 1fr · 304`, md `1fr · 280`, phone one column. Gutters 24. */
export function ThreeColumnLayout({ left, leftLabel = "Your profile", right, rightLabel = "Suggestions", hideRightOnPhone, children }: ThreeColumnProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-page items-start pb-4 pt-2 max-md:block md:grid md:grid-cols-[minmax(0,1fr)_var(--rail-tablet)] md:gap-6 page-x md:pb-12 md:pt-5",
        left ? "lg:grid-cols-[var(--rail-left)_minmax(0,1fr)_var(--rail-feed)]" : "lg:grid-cols-[minmax(0,1fr)_var(--rail-feed)]",
      )}
    >
      {left && (
        <StickyAside aria-label={leftLabel} className={cn("hidden min-w-0 flex-col gap-3 lg:flex", STICKY)}>
          {left}
        </StickyAside>
      )}
      <main id="main" tabIndex={-1} className={MAIN}>
        {children}
      </main>
      <RightRail label={rightLabel} className={cn(STICKY, hideRightOnPhone ? "max-md:hidden" : "max-md:mt-2")}>
        {right}
      </RightRail>
    </div>
  );
}

type TwoColumnProps = {
  /** Spans both columns above the grid so the rail top aligns with the first card (md and up). */
  breadcrumb?: ReactNode;
  /** Rail cards; the legal footer is appended. */
  rail?: ReactNode;
  railLabel?: string;
  children: ReactNode;
};

/**
 * Profile, program and job detail: lg `1fr (max 808) · 320`; 961–1080 `1fr · 280`; 721–960 one
 * column with rail cards below in a 2-up grid; phone one column with the rail below main.
 */
export function TwoColumnLayout({ breadcrumb, rail, railLabel = "Related", children }: TwoColumnProps) {
  return (
    <div className="mx-auto grid w-full max-w-page items-start gap-x-6 gap-y-2 pb-4 pt-2 md:gap-y-3 page-x md:pb-12 md:pt-5 min-[961px]:grid-cols-[minmax(0,1fr)_var(--rail-tablet)] lg:grid-cols-[minmax(0,1fr)_var(--rail-profile)]">
      {/* The page top is 20px in every layout; the breadcrumb row is the fixed 32px BREADCRUMB_ROW. Hidden on phone (§8.4). */}
      {breadcrumb && <div className={cn("col-span-full max-md:hidden", BREADCRUMB_ROW)}>{breadcrumb}</div>}
      <main id="main" tabIndex={-1} className={MAIN}>
        {children}
      </main>
      <RightRail
        label={railLabel}
        stickyOffset={16}
        className="min-[961px]:sticky min-[961px]:top-[var(--rail-top,calc(var(--nav-h)+16px))] md:max-[961px]:grid md:max-[961px]:grid-cols-2 md:max-[961px]:items-start md:max-[961px]:*:self-start"
      >
        {rail}
      </RightRail>
    </div>
  );
}

type SidebarProps = {
  /** Facets (lg only, no card, sticky). Below lg the page opens them in a sheet. */
  sidebar?: ReactNode;
  sidebarLabel?: string;
  children: ReactNode;
};

/** Search: lg `232 · 1fr`; md and phone one column. */
export function SidebarLayout({ sidebar, sidebarLabel = "Filters", children }: SidebarProps) {
  return (
    <div className="mx-auto grid w-full max-w-page items-start gap-6 pb-4 pt-2 page-x md:pb-12 md:pt-5 lg:grid-cols-[var(--rail-left)_minmax(0,1fr)]">
      {sidebar && (
        <StickyAside aria-label={sidebarLabel} className={cn("hidden min-w-0 lg:block", STICKY)}>
          {sidebar}
        </StickyAside>
      )}
      <div className={cn("min-w-0", !sidebar && "lg:col-span-full")}>
        <main id="main" tabIndex={-1} className={MAIN}>
          {children}
        </main>
        <LegalFooter className="mt-4 md:mt-6" />
      </div>
    </div>
  );
}

/** Single centered column (claim flow, settings): max 640. */
export function SingleColumnLayout({ children, footer = true, breadcrumb }: { children: ReactNode; footer?: boolean; breadcrumb?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[640px] pb-4 pt-2 page-x md:pb-12 md:pt-5 md:box-content">
      {breadcrumb && <div className={cn(BREADCRUMB_ROW, "md:mb-3")}>{breadcrumb}</div>}
      <main id="main" tabIndex={-1} className={MAIN}>
        {children}
      </main>
      {footer && <LegalFooter align="center" className="mt-4 md:mt-6" />}
    </div>
  );
}
