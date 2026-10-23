import { Fragment } from "react";
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
 * cases the source leaves open ("Current" / "Start year not in source"). Each year span never wraps or
 * truncates; a list of stints ("1995–1996, 2000–2002, …") may wrap between spans, so a long one stays
 * inside the card on a phone. On a partial range only the year carries the inferred mark ("Through 2000").
 */
export function LedgerRange({ text, inferred, reason, className }: LedgerRangeProps) {
  const pieces = text.range.split(", ");
  const years = (
    <>
      {pieces.map((piece, i) => (
        // The space after each comma sits outside the no-wrap span: that is where the line may break.
        <Fragment key={i}>
          <span className="whitespace-nowrap">
            {piece}
            {i < pieces.length - 1 && ","}
          </span>
          {i < pieces.length - 1 && " "}
        </Fragment>
      ))}
    </>
  );
  const range = inferred && !text.undated && !text.noYear ? <InferredYear reason={reason}>{years}</InferredYear> : years;
  return (
    <span className={cn("flex shrink-0 flex-wrap items-baseline gap-x-1.5 md:block md:min-w-32 md:max-w-60 md:text-right", className)}>
      <span
        className={cn(
          "block text-small leading-5 tabular-nums",
          pieces.length > 1 ? "min-w-0" : "whitespace-nowrap",
          text.undated ? "text-caption text-fg-3" : "font-semibold text-fg-1 md:font-medium",
        )}
      >
        {text.lead}
        {range}
      </span>
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
