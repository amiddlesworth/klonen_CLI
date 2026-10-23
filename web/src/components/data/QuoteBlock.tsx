import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type QuoteBlockProps = {
  /** Verbatim source text, typos included. Curly quotes are added. */
  quote: string;
  /** 12px --fg-3 line: "From the MIT staff bio" or a SourceLink. */
  attribution?: ReactNode;
  /** "sm" 13/20 (feed, Source disclosure) or "md" 14/22 (About). */
  size?: "sm" | "md";
  /** --fg-1 (default) or --fg-2 (inside a Source disclosure). */
  tone?: "default" | "muted";
  className?: string;
};

/** Quote block (§8.3): 2px --border-strong left rule, curly quotes, attribution below, max 68ch. Never italic. */
export function QuoteBlock({ quote, attribution, size = "sm", tone = "default", className }: QuoteBlockProps) {
  const text = quote.trim().replace(/^["“]|["”]$/g, "");
  return (
    <figure className={cn("max-w-[68ch] border-l-2 border-border-strong py-0.5", size === "md" ? "pl-3.5" : "pl-3", className)}>
      <blockquote>
        <p className={cn(size === "md" ? "text-prose" : "text-small leading-5", tone === "muted" ? "text-fg-2" : "text-fg-1")}>“{text}”</p>
      </blockquote>
      {attribution && <figcaption className={cn("flex flex-wrap items-center gap-1 text-caption text-fg-3", size === "md" ? "mt-1.5" : "mt-0.5")}>{attribution}</figcaption>}
    </figure>
  );
}
