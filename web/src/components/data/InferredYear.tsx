import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type InferredYearProps = {
  children: ReactNode;
  /** Plain-words reason, quoting the source where possible ("Inferred from 'two years' between…"). */
  reason?: string | null;
  className?: string;
};

/**
 * A year (or range) from a tenure with yearsExplicit = false (§6.2): dotted 1.5px underline in
 * --fg-3, a tooltip with the reason and screen-reader "(inferred)" text. Pages that show one must
 * also explain the mark once in visible text (see InferredFootnote).
 */
export function InferredYear({ children, reason, className }: InferredYearProps) {
  return (
    <>
      <span className={cn("inf", className)} title={reason ? `Inferred: ${reason}` : "Inferred from the source, not stated in it"}>
        {children}
      </span>
      <span className="sr-only"> (inferred)</span>
    </>
  );
}

/** The one wording of the dotted-year explanation (audit X18): footnotes in lists and cards… */
export const INFERRED_NOTE = "Dotted years are inferred from the staff bio, not stated in it.";
/** …and the legend entry next to a sample dotted year (profile Experience, claim review). */
export const INFERRED_LEGEND = "Year inferred from the staff bio, not stated in it";

/**
 * The key to the dotted mark (§6.2, audit C03), the one legend for profile Experience, the tree explorer
 * and the claim steps. `year` is a year actually dotted in the card it explains, shown as the sample
 * ("2017 Year inferred from the staff bio, not stated in it"), never a made-up one. Without a year it
 * says "Dotted years are inferred from the staff bio, not stated in it." with "Dotted" carrying the mark.
 * Renders inline (a span); the caller sets the text size and color (12px --fg-3 in every use).
 */
export function InferredKey({ year, className }: { year?: number | null; className?: string }) {
  if (year == null) {
    return (
      <span className={className}>
        <span className="inf cursor-default">Dotted</span>
        {INFERRED_NOTE.replace(/^Dotted/, "")}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden="true" className="inf num cursor-default font-medium text-fg-2">
        {year}
      </span>
      {INFERRED_LEGEND}
    </span>
  );
}

/** The visible explanation of the dotted underline, shown once per page (12px --fg-3). */
export function InferredFootnote({ children, className }: { children?: ReactNode; className?: string }) {
  return <p className={cn("text-caption text-fg-3", className)}>{children ?? INFERRED_NOTE}</p>;
}
