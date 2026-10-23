import { Fragment, type ReactNode } from "react";
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
 * Which part of a range carries the dotted mark (§6.2). "Present" comes from the source, so on a current
 * range only the start year is dotted ("2020–Present"). On several stints only the first piece is (the
 * group's mark is the earliest role's). On a closed range the source doesn't say which bound was derived,
 * so the whole range is dotted.
 */
function markPiece(piece: string, reason: string | null | undefined): ReactNode {
  const current = piece.match(/^(\d{4})(–Present)$/);
  if (current) {
    return (
      <>
        <InferredYear reason={reason}>{current[1]}</InferredYear>
        {current[2]}
      </>
    );
  }
  return /\d/.test(piece) ? <InferredYear reason={reason}>{piece}</InferredYear> : piece;
}

/**
 * Ledger range (§8.3 SeasonRange): two lines right-aligned in a 128px column on md and up (range
 * 13/500 tabular over a 12px --fg-3 count); on phone one line under the title (range 600 · count).
 * The text comes from seasonRange()/seasonRangeMulti() through model.ts, which also words the partial
 * cases the source leaves open ("Current" / "Start year not in source"). A year span never wraps or
 * truncates. A list of stints ("1995–1996, 2000–2002, …") takes its natural width; where it can't (a
 * phone, a narrow column) it breaks only between stints, and on phone its count gets its own line, so no
 * line starts with "·". On a partial range only the year carries the inferred mark ("Through 2000").
 */
export function LedgerRange({ text, inferred, reason, className }: LedgerRangeProps) {
  const pieces = text.range.split(", ");
  const multi = pieces.length > 1;
  const mark = inferred && !text.undated && !text.noYear;
  return (
    <span
      className={cn(
        "flex shrink-0 flex-wrap items-baseline gap-x-1.5 md:block md:min-w-32 md:text-right",
        multi && "max-md:flex-col max-md:items-start",
        className,
      )}
    >
      <span
        className={cn(
          "block text-small leading-5 tabular-nums",
          multi ? "min-w-0" : "whitespace-nowrap",
          text.undated ? "text-caption text-fg-3" : "font-semibold text-fg-1 md:font-medium",
        )}
      >
        {text.lead}
        {pieces.map((piece, i) => (
          // The space after each comma sits outside the no-wrap span: that is the only place a line may break.
          <Fragment key={i}>
            <span className="whitespace-nowrap">
              {mark && i === 0 ? markPiece(piece, reason) : piece}
              {i < pieces.length - 1 && ","}
            </span>
            {i < pieces.length - 1 && " "}
          </Fragment>
        ))}
      </span>
      {text.count && (
        <>
          {!multi && (
            <span aria-hidden="true" className="text-caption text-fg-3 md:hidden">
              ·
            </span>
          )}
          <span className="num block whitespace-nowrap text-caption text-fg-3">{text.count}</span>
        </>
      )}
    </span>
  );
}
