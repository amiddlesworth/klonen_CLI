import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardPadding = "none" | "main" | "rail";

const PADDING: Record<CardPadding, string> = {
  none: "",
  // Main-column cards: 20px 24px on desktop, 16px on phone.
  main: "p-4 md:px-6 md:py-5",
  // Rail cards, feed items and every phone card: 16px.
  rail: "p-4",
};

export type CardProps = ComponentProps<"section"> & {
  as?: ElementType;
  padding?: CardPadding;
};

/**
 * Level 1 surface (§5.3): --surface, 1px --border, radius 8. Phone cards are full-bleed:
 * radius 0 and no side borders.
 */
export function Card({ as: Tag = "section", padding = "none", className, ...rest }: CardProps) {
  return <Tag className={cn("min-w-0 border-y border-border bg-surface md:rounded-md md:border", PADDING[padding], className)} {...rest} />;
}

export type CardHeaderProps = {
  title: ReactNode;
  /** Heading element for the title (default h2). */
  as?: "h1" | "h2" | "h3";
  id?: string;
  /** Right side: at most one meta ("7 people", text-small --fg-3)… */
  meta?: ReactNode;
  /** …and one link ("Explore tree →"). */
  action?: ReactNode;
  /** Optional line under the title (12px --fg-3), used by rail cards. */
  subtitle?: ReactNode;
  /** "main" = text-title 16/24; "rail" = 14/20 600. */
  size?: "main" | "rail";
  className?: string;
};

/**
 * Card header row: title left, meta and one link right, baseline-aligned. The row wraps instead of
 * squeezing: when title and meta don't fit side by side, the meta drops to its own line, left-
 * aligned under the title at every width, and wraps there with a straight left edge. (The title
 * grows to fill its line, which is what pushes the meta right while they share one; there is no
 * auto margin or right alignment to carry over to the wrapped line.) The title is never squeezed
 * by the meta, and only the link keeps its width. Keep meta short ("7 people"); a sentence belongs
 * in `subtitle` or a footnote.
 */
export function CardHeader({ title, as: Tag = "h2", id, meta, action, subtitle, size = "main", className }: CardHeaderProps) {
  return (
    <div className={cn(size === "main" ? "mb-3" : "mb-1", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <Tag id={id} className={cn("grow", size === "main" ? "text-title" : "text-body font-semibold")}>
          {title}
        </Tag>
        {(meta || action) && (
          <div className="flex min-w-0 items-baseline gap-4">
            {meta && <span className="min-w-0 text-small text-fg-3 tabular-nums">{meta}</span>}
            {action && <span className="shrink-0">{action}</span>}
          </div>
        )}
      </div>
      {subtitle && <p className="mt-0.5 text-caption text-fg-3">{subtitle}</p>}
    </div>
  );
}

/** Footer row inside a card: divider above, 12px padding (e.g. "All moves →", "Show more"). */
export function CardFooter({ className, ...rest }: ComponentProps<"div">) {
  return <div className={cn("mt-3 border-t border-divider pt-3", className)} {...rest} />;
}
