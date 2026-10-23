"use client";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Item = { key: string; node: ReactNode };

type ExperienceListProps = {
  /** Programs with years, newest first. */
  dated: Item[];
  /** Programs the source gives no years for (no place in the order). */
  undated: Item[];
  personName: string;
  /** Programs shown before "Show all {n} programs" when the career is long. */
  limit: number;
};

const ITEM = "grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 border-t border-divider py-4 outline-offset-0 first:border-t-0 focus-visible:outline-2";

/**
 * The Experience program list (§8.4): newest first, then the programs without years under their own label
 * ("Years not in source · order unknown"), so the newest-first claim covers only the dated ones. A long
 * career starts with the newest `limit` programs and ends with a full-width secondary "Show all {n}
 * programs" (§8.1 ShowMore). Every group is in the HTML; the hidden ones only wait for the button.
 */
export function ExperienceList({ dated, undated, personName, limit }: ExperienceListProps) {
  const total = dated.length + undated.length;
  const truncates = total > limit;
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const shown = !truncates || expanded ? total : limit;
  const undatedShown = Math.max(0, shown - dated.length);

  const expand = () => {
    setExpanded(true);
    // Move focus to the first program that was hidden, so keyboard and screen-reader users land on it.
    requestAnimationFrame(() => rootRef.current?.querySelectorAll<HTMLElement>("li[data-program]")[limit]?.focus());
  };

  return (
    <div ref={rootRef}>
      <ol aria-label={`${personName}'s coaching career, newest first`}>
        {dated.map((item, i) => (
          <li key={item.key} data-program tabIndex={-1} className={cn(ITEM, i >= shown && "hidden")}>
            {item.node}
          </li>
        ))}
      </ol>
      {undated.length > 0 && (
        <section aria-labelledby="experience-undated" className={cn(undatedShown === 0 && "hidden")}>
          <h3 id="experience-undated" className="border-t border-divider pt-3 text-caption text-fg-3">
            Years not in source · order unknown
          </h3>
          <ul>
            {undated.map((item, i) => (
              <li key={item.key} data-program tabIndex={-1} className={cn(ITEM, "first:border-t-0 first:pt-3", i >= undatedShown && "hidden")}>
                {item.node}
              </li>
            ))}
          </ul>
        </section>
      )}
      {truncates && !expanded && (
        <div className="pb-4">
          <Button fullWidth phone="large" onClick={expand}>
            Show all {total} programs
          </Button>
        </div>
      )}
    </div>
  );
}
