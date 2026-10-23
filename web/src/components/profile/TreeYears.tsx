import { InferredYear } from "@/components/data/InferredYear";
import { SeasonRange } from "@/components/data/SeasonRange";
import { cn } from "@/lib/cn";
import { seasonRangeCompact } from "@/lib/format";
import type { TreeYearsView } from "./model";

/**
 * A tree link's years on the right of its row (§8.4): the compact range ("2010–12", "2020–"), dotted when
 * inferred; "Current" when the two are on a staff together now but the source doesn't say since when;
 * nothing when the source doesn't pin the years. Never a filled-in season.
 */
export function TreeRange({ view, className }: { view: TreeYearsView; className?: string }) {
  if (view.kind === "none") return null;
  if (view.kind === "current") {
    return (
      <span className={cn("text-caption font-medium text-fg-2", className)} title="On the same staff now. The start year is not in the source.">
        Current<span className="sr-only"> (start year not in source)</span>
      </span>
    );
  }
  return (
    <SeasonRange
      variant="compact"
      startYear={view.startYear}
      endYear={view.endYear}
      isCurrent={view.ongoing}
      inferred={view.inferred}
      inferredReason={view.reason}
      className={className}
    />
  );
}

/** The same years inside a sentence ("Played for Ian 2024–25", "both at George Fox, 2015–24"). */
export function InlineYears({ view }: { view: TreeYearsView }) {
  if (view.kind !== "range") return null;
  const text = seasonRangeCompact(view.startYear, view.endYear, view.ongoing);
  return <span className="num">{view.inferred ? <InferredYear reason={view.reason}>{text}</InferredYear> : text}</span>;
}
