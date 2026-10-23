import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { SearchPreset } from "./presets";

type QuickSearchesProps = {
  presets: SearchPreset[];
  /** id of the visible label (the page renders the band and the phone card; each needs its own). */
  id: string;
  /**
   * "band" (default): at the bottom of the pipeline header card (--surface-2, divider above); used
   * from md. "card": the content of its own card after the board on phone, titled like a card.
   */
  variant?: "band" | "card";
  className?: string;
};

/**
 * "Quick searches": people searches built from the hiring search and the employer's program.
 * Phone: the label on its own line, then full-width 44px link rows (search icon, label, chevron)
 * split by dividers. md and up: a two-column grid, label | links, so wrapped links line up under
 * the first link, with 4px between 24px targets.
 */
export function QuickSearches({ presets, id, variant = "band", className }: QuickSearchesProps) {
  if (!presets.length) return null;
  const card = variant === "card";
  return (
    <nav
      aria-labelledby={id}
      className={cn(
        card ? "pb-1" : "border-t border-divider bg-surface-2 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-x-4 md:px-6 md:py-2.5",
        className,
      )}
    >
      {card ? (
        <h2 id={id} className="px-4 pb-1 pt-3 text-title">
          Quick searches
        </h2>
      ) : (
        <p id={id} className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-small text-fg-2 md:h-6 md:p-0">
          <Icon icon={Search} size={16} className="max-md:hidden" />
          Quick searches
        </p>
      )}
      <ul className="md:flex md:flex-wrap md:gap-x-4 md:gap-y-1">
        {presets.map((p) => (
          <li key={p.href} className="border-divider max-md:border-t max-md:first:border-t-0">
            <Link
              href={p.href}
              className="flex min-h-11 items-center gap-3 px-4 text-small font-medium text-fg-1 underline-offset-2 transition-colors hover:bg-hover focus-visible:-outline-offset-2 md:min-h-6 md:px-0 md:text-link md:hover:bg-transparent md:hover:underline md:focus-visible:outline-offset-2"
            >
              <Icon icon={Search} size={16} className="text-fg-2 md:hidden" />
              <span className="min-w-0 flex-1">{p.label}</span>
              <Icon icon={ChevronRight} size={16} className="text-fg-3 md:hidden" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
