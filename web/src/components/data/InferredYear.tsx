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

/** The visible explanation of the dotted underline, shown once per page (12px --fg-3). */
export function InferredFootnote({ children, className }: { children?: ReactNode; className?: string }) {
  return <p className={cn("text-caption text-fg-3", className)}>{children ?? "Dotted years are inferred from the bio, not stated in it."}</p>;
}
