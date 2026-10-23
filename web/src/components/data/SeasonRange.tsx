import { cn } from "@/lib/cn";
import { seasonRange, seasonRangeCompact, seasonRangeLabel, seasonRangeMulti, type StintSpan } from "@/lib/format";
import { InferredYear } from "./InferredYear";

export type SeasonRangeProps = {
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  /** Several stints at one program: "2003, 2006–2009" / "5 seasons · 2 stints". Overrides start/end. */
  stints?: StintSpan[];
  /** True when the tenure has yearsExplicit = false. */
  inferred?: boolean;
  inferredReason?: string | null;
  /**
   * "ledger": two lines right-aligned in a 128px column (range 13/500 over count 12 --fg-3);
   *           on phone one line under the title (range 600 · count).
   * "inline": always one line (range 600 · count).
   * "compact": tree rows, rails and the MoveRecord column ("2010–19", "2020–"), 12/500.
   */
  variant?: "ledger" | "inline" | "compact";
  className?: string;
};

/** Season range (§6.1, §8.3): tabular numerals, en dash, never wraps or truncates. */
export function SeasonRange({ startYear, endYear, isCurrent, stints, inferred, inferredReason, variant = "ledger", className }: SeasonRangeProps) {
  if (variant === "compact") {
    const text = seasonRangeCompact(startYear, endYear, isCurrent);
    return (
      <span className={cn("num text-caption font-medium", className)} aria-label={seasonRangeLabel(startYear, endYear, isCurrent) + (inferred ? " (inferred)" : "")}>
        {inferred ? (
          <span className="inf" title={inferredReason ? `Inferred: ${inferredReason}` : "Inferred from the source, not stated in it"} aria-hidden="true">
            {text}
          </span>
        ) : (
          <span aria-hidden="true">{text}</span>
        )}
      </span>
    );
  }

  const { range, count } = stints?.length ? seasonRangeMulti(stints) : seasonRange(startYear, endYear, isCurrent);
  const undated = !startYear && !stints?.some((s) => s.startYear);
  const rangeNode = inferred && !undated ? <InferredYear reason={inferredReason}>{range}</InferredYear> : range;

  if (variant === "inline") {
    return (
      <span className={cn("num inline-flex items-baseline gap-1.5 text-small leading-5", className)}>
        <span className={cn(undated ? "text-caption font-normal text-fg-3" : "font-semibold text-fg-1")}>{rangeNode}</span>
        {count && (
          <>
            <span aria-hidden="true" className="text-fg-3">
              ·
            </span>
            <span className="text-caption text-fg-3">{count}</span>
          </>
        )}
      </span>
    );
  }

  return (
    <span className={cn("flex shrink-0 items-baseline gap-1.5 md:block md:w-32 md:text-right", className)}>
      <span className={cn("num block text-small leading-5", undated ? "text-caption font-normal text-fg-3" : "font-semibold md:font-medium")}>{rangeNode}</span>
      {count && (
        <>
          <span aria-hidden="true" className="text-caption text-fg-3 md:hidden">
            ·
          </span>
          <span className="num block text-caption text-fg-3">{count}</span>
        </>
      )}
    </span>
  );
}
