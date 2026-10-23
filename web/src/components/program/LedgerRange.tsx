import { Fragment, type ReactNode } from "react";
import { InferredYear } from "@/components/data/InferredYear";
import { cn } from "@/lib/cn";
import { seasonRangeCompact, seasonRangeLabel, seasonRangeMulti } from "@/lib/format";
import { compactRangePieces, compactSpan, firstInferredYear, ledgerRangePieces, type LedgerStint, type RangePiece } from "@/lib/queries/program";
import { evidenceReason } from "./text";

const textOf = (pieces: RangePiece[]) => pieces.map((p) => (typeof p === "string" ? p : p.text)).join("");

/** True when the printed range (ledger or compact) has an inferred year, so the page must explain the mark. */
export function rangeHasInferred(stints: LedgerStint[], variant: "ledger" | "compact" = "ledger"): boolean {
  return !!firstInferredYear(stints, variant);
}

function render(pieces: RangePiece[]): ReactNode {
  return pieces.map((p, i) =>
    typeof p === "string" || !p.inferred ? (
      <Fragment key={i}>{typeof p === "string" ? p : p.text}</Fragment>
    ) : (
      <InferredYear key={i} reason={evidenceReason(p.evidence)}>
        {p.text}
      </InferredYear>
    ),
  );
}

/**
 * Season range for program lists (§6.1, §8.3 SeasonRange ledger layout): two lines right-aligned
 * in a column at least 128px wide (range 13/500 over count 12 --fg-3), one line under the title on
 * phone (range 600 · count). Unlike a whole-range mark, only the years that are inferred get the
 * dotted underline and "(inferred)" text (§6.2): "2010–2012, 2020–Present" dots 2010 and 2012 alone
 * when only that stint's years are inferred. The text always equals seasonRangeMulti().
 */
export function LedgerRange({ stints, className }: { stints: LedgerStint[]; className?: string }) {
  const { range, count } = seasonRangeMulti(stints);
  const pieces = ledgerRangePieces(stints);
  // Safety: the pieces must spell exactly what format.ts prints; otherwise print its text unmarked.
  const node = pieces && textOf(pieces) === range ? render(pieces) : range;
  return (
    <span className={cn("flex shrink-0 items-baseline gap-1.5 md:block md:min-w-32 md:text-right", className)}>
      <span className="num block whitespace-nowrap text-small font-semibold leading-5 md:font-medium">{node}</span>
      {count && (
        <>
          <span aria-hidden="true" className="text-caption text-fg-3 md:hidden">
            ·
          </span>
          <span className="num block whitespace-nowrap text-caption text-fg-3">{count}</span>
        </>
      )}
    </span>
  );
}

/** Compact range for rail rows ("2008–11", "2020–", §6.1), 12/500, the full range and count for screen readers; inferred years dotted. */
export function CompactRange({ stints, className }: { stints: LedgerStint[]; className?: string }) {
  const span = compactSpan(stints);
  const pieces = compactRangePieces(stints);
  if (!span || !pieces) return null;
  const text = seasonRangeCompact(span.start, span.end, span.current);
  const inferred = pieces.some((p) => typeof p !== "string" && p.inferred);
  return (
    <span className={cn("num whitespace-nowrap text-caption font-medium", className)}>
      <span className="sr-only">{seasonRangeLabel(span.start, span.end, span.current) + (inferred ? " (inferred)" : "")}</span>
      <span aria-hidden="true">
        {textOf(pieces) === text
          ? pieces.map((p, i) =>
              typeof p === "string" || !p.inferred ? (
                <Fragment key={i}>{typeof p === "string" ? p : p.text}</Fragment>
              ) : (
                <span key={i} className="inf" title={`Inferred: ${evidenceReason(p.evidence)}`}>
                  {p.text}
                </span>
              ),
            )
          : text}
      </span>
    </span>
  );
}
