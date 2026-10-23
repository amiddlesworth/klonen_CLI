import { InferredYear } from "@/components/data/InferredYear";
import { cn } from "@/lib/cn";
import type { RangeText } from "./model";

type LedgerRangeProps = {
  text: RangeText;
  inferred?: boolean;
  reason?: string | null;
  className?: string;
};

/**
 * Ledger range (§8.3 SeasonRange): two lines right-aligned in a 128px column on md and up (range
 * 13/500 tabular over a 12px --fg-3 count); on phone one line under the title (range 600 · count).
 * The text comes from seasonRange()/seasonRangeMulti() through model.ts, which also words the partial
 * cases the source leaves open ("Current" / "Start year not in source"). Never wraps or truncates.
 */
export function LedgerRange({ text, inferred, reason, className }: LedgerRangeProps) {
  const range = inferred && !text.undated ? <InferredYear reason={reason}>{text.range}</InferredYear> : text.range;
  return (
    <span className={cn("flex shrink-0 flex-wrap items-baseline gap-x-1.5 md:block md:min-w-32 md:text-right", className)}>
      <span className={cn("num block text-small leading-5", text.undated ? "text-caption text-fg-3" : "font-semibold text-fg-1 md:font-medium")}>{range}</span>
      {text.count && (
        <>
          <span aria-hidden="true" className="text-caption text-fg-3 md:hidden">
            ·
          </span>
          <span className="num block text-caption text-fg-3">{text.count}</span>
        </>
      )}
    </span>
  );
}
