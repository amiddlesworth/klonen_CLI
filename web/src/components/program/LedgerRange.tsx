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

/** Split range pieces into stints at the ", " separators seasonRangeMulti() prints between them. */
function splitRuns(pieces: RangePiece[]): RangePiece[][] {
  const runs: RangePiece[][] = [[]];
  for (const p of pieces) {
    if (p === ", ") runs.push([]);
    else runs[runs.length - 1].push(p);
  }
  return runs.filter((r) => r.length);
}

/**
 * A multi-stint range that can break only after a comma: each stint ("1988–2004") is one nowrap span,
 * the comma stays on its stint, and the space after it is the only break. Nothing is truncated (§6.1).
 * `trailing` is glued to the last stint (inside its nowrap span), e.g. the "·" before a count.
 */
export function RangeRuns({ pieces, trailing }: { pieces: RangePiece[]; trailing?: ReactNode }) {
  const runs = splitRuns(pieces);
  return runs.map((run, i) => (
    <Fragment key={i}>
      <span className="whitespace-nowrap tabular-nums">
        {render(run)}
        {i < runs.length - 1 ? "," : trailing}
      </span>
      {i < runs.length - 1 && " "}
    </Fragment>
  ));
}

/**
 * Season range for program lists (§6.1, §8.3 SeasonRange ledger layout): two lines right-aligned
 * in a column at least 128px wide (range 13/500 over count 12 --fg-3), one line under the title on
 * phone (range 600 · count). Only the years that are inferred get the dotted underline and
 * "(inferred)" text (§6.2). The text always equals seasonRangeMulti().
 *
 * Phone: the range and "· N seasons · M stints" wrap instead of pushing the page sideways (§11 rule 12).
 * A long range breaks only after a comma between stints (each year pair stays whole), and the count
 * is one nowrap unit that drops under the range, so nothing is cut off. The "·" between them is glued
 * to the range's last stint, so a wrapped count never starts its line with punctuation.
 */
export function LedgerRange({ stints, className }: { stints: LedgerStint[]; className?: string }) {
  const { range, count } = seasonRangeMulti(stints);
  const pieces = ledgerRangePieces(stints);
  const dot = count ? (
    <span aria-hidden="true" className="ml-1.5 text-caption font-normal text-fg-3 md:hidden">
      ·
    </span>
  ) : null;
  // Safety: the pieces must spell exactly what format.ts prints; otherwise print its text unmarked.
  const node = <RangeRuns pieces={pieces && textOf(pieces) === range ? pieces : range.split(/(, )/)} trailing={dot} />;
  return (
    <span className={cn("flex min-w-0 flex-wrap items-baseline gap-x-1.5 md:block md:min-w-32 md:text-right", className)}>
      {/* tabular-nums, not the num utility: num also sets nowrap, and this span must break between stints. */}
      <span className="text-small font-semibold leading-5 tabular-nums md:block md:font-medium">{node}</span>
      {count && <span className="num text-caption text-fg-3 md:block">{count}</span>}
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
