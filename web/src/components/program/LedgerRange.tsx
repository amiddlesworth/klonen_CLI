import { Fragment, type ReactNode } from "react";
import { InferredYear } from "@/components/data/InferredYear";
import { cn } from "@/lib/cn";
import { seasonRangeCompact, seasonRangeLabel, seasonRangeMulti, seasonSpans, type StintSpan } from "@/lib/format";
import { evidenceReason } from "./text";

/** A stint with year provenance (tenures.years_explicit and the evidence quote). */
export type MarkedStint = StintSpan & { yearsExplicit: boolean; evidence: string | null };

type Year = { year: number; text: string; inferred: boolean; evidence: string | null };
type Piece = string | Year;

/**
 * Whether a printed boundary year is inferred: every stint that starts (or ends) the run on that
 * year has yearsExplicit = false. A year one stint states and another infers counts as stated.
 */
function mark(stints: MarkedStint[], year: number, edge: "start" | "end", text = String(year)): Year {
  const hits = stints.filter((s) => {
    const end = s.startYear ? Math.max(s.startYear, s.endYear ?? s.startYear) : s.endYear;
    if (edge === "start") return s.startYear ? s.startYear === year : !s.isCurrent && s.endYear === year;
    return !s.isCurrent && end === year;
  });
  const inferred = hits.length > 0 && hits.every((s) => !s.yearsExplicit);
  return { year, text, inferred, evidence: inferred ? (hits.find((s) => s.evidence)?.evidence ?? null) : null };
}

/** The ledger range as pieces, matching seasonRangeMulti() text exactly ("2003, 2006–2009", "2010–Present"). */
function multiPieces(stints: MarkedStint[]): Piece[] {
  const spans = seasonSpans(stints);
  const out: Piece[] = [];
  spans.forEach((m, i) => {
    if (i > 0) out.push(", ");
    if (m.undatedCurrent) out.push("Present");
    else if (m.isCurrent) out.push(mark(stints, m.start, "start"), "–Present");
    else if (m.start === m.end) {
      const a = mark(stints, m.start, "start");
      const b = mark(stints, m.end, "end");
      out.push({ ...a, inferred: a.inferred || b.inferred, evidence: a.evidence ?? b.evidence });
    } else out.push(mark(stints, m.start, "start"), "–", mark(stints, m.end, "end"));
  });
  return out;
}

/** First to last season (compact, for rails): matches seasonRangeCompact() text ("2008–11", "2020–"). */
export function compactSpan(stints: MarkedStint[]): { start: number; end: number | null; current: boolean } | null {
  const dated = stints.filter((s) => s.startYear);
  if (!dated.length) return null;
  const current = dated.some((s) => s.isCurrent);
  const start = Math.min(...dated.map((s) => s.startYear!));
  const end = current ? null : Math.max(...dated.map((s) => s.endYear ?? s.startYear!));
  return { start, end, current };
}

function compactPieces(stints: MarkedStint[]): Piece[] | null {
  const span = compactSpan(stints);
  if (!span) return null;
  const { start, end, current } = span;
  if (current) return [mark(stints, start, "start"), "–"];
  const last = end ?? start;
  if (last === start) return [mark(stints, start, "start")];
  const short = Math.floor(last / 100) === Math.floor(start / 100) ? String(last).slice(2) : String(last);
  return [mark(stints, start, "start"), "–", mark(stints, last, "end", short)];
}

const textOf = (pieces: Piece[]) => pieces.map((p) => (typeof p === "string" ? p : p.text)).join("");

/** True when the printed range (ledger or compact) has an inferred year, so the page must explain the mark. */
export function rangeHasInferred(stints: MarkedStint[], variant: "ledger" | "compact" = "ledger"): boolean {
  const pieces = variant === "compact" ? compactPieces(stints) : stints.some((s) => s.startYear) ? multiPieces(stints) : null;
  return !!pieces?.some((p) => typeof p !== "string" && p.inferred);
}

function render(pieces: Piece[]): ReactNode {
  return pieces.map((p, i) =>
    typeof p === "string" ? (
      <Fragment key={i}>{p}</Fragment>
    ) : p.inferred ? (
      <InferredYear key={i} reason={evidenceReason(p.evidence)}>
        {p.text}
      </InferredYear>
    ) : (
      <Fragment key={i}>{p.text}</Fragment>
    ),
  );
}

/**
 * Season range for program lists (§6.1, §8.3 SeasonRange ledger layout): two lines right-aligned
 * in a column at least 128px wide (range 13/500 over count 12 --fg-3), one line under the title on
 * phone (range 600 · count). Unlike a whole-range mark, only the years that are inferred get the
 * dotted underline and "(inferred)" text (§6.2): "2010–2012, 2020–Present" dots 2010 alone when
 * only that year is inferred. Text always equals seasonRangeMulti().
 */
export function LedgerRange({ stints, className }: { stints: MarkedStint[]; className?: string }) {
  const { range, count } = seasonRangeMulti(stints);
  const pieces = multiPieces(stints);
  // Safety: the pieces must spell exactly what format.ts prints; otherwise print its text unmarked.
  const node = textOf(pieces) === range ? render(pieces) : range;
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

/** Compact range for rail rows ("2008–11", "2020–", §6.1), 12/500, full range and count in aria-label; inferred years dotted. */
export function CompactRange({ stints, className }: { stints: MarkedStint[]; className?: string }) {
  const span = compactSpan(stints);
  const pieces = compactPieces(stints);
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
