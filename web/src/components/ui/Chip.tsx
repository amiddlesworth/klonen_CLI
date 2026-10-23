import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChipKind = "neutral" | "abbr" | "outline" | "sample";

const BASE = "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-xs px-1.5 align-[1px] text-caption font-medium text-fg-2";

const KIND: Record<ChipKind, string> = {
  neutral: "bg-hover",
  abbr: "bg-hover font-semibold tracking-[.02em]",
  outline: "bg-transparent shadow-[inset_0_0_0_1px_var(--control)]",
  sample: "border border-dashed border-control bg-transparent",
};

export type ChipProps = {
  kind?: ChipKind;
  /** Full name or explanation, shown on hover (required for abbreviations). */
  title?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Chip (§8.1): 20px, radius 4, 12/500, 6px side padding, never interactive.
 * Neutral `D-III` · Abbreviation `NWC` (full name in title) · Outline `Unclaimed` · Sample (dashed) `Sample listing`.
 */
export function Chip({ kind = "neutral", title, className, children }: ChipProps) {
  const classes = cn(BASE, KIND[kind], className);
  if (kind === "abbr") {
    return (
      <abbr title={title} className={cn(classes, "no-underline")}>
        {children}
      </abbr>
    );
  }
  return (
    <span title={title} className={classes}>
      {children}
    </span>
  );
}

/** Outline chip next to the name of a profile built from public sources. */
export function UnclaimedChip({ className }: { className?: string }) {
  return (
    <Chip kind="outline" title="Built from public sources. This coach has not claimed the profile yet." className={className}>
      Unclaimed
    </Chip>
  );
}

/** Dashed chip on any demo or sample record: "Sample listing" for jobs, "Demo" elsewhere, "Sample" on aggregates. */
export function SampleChip({ label = "Demo", className }: { label?: "Demo" | "Sample listing" | "Sample"; className?: string }) {
  const title =
    label === "Sample listing"
      ? "A sample job created for the demo, not a real opening."
      : label === "Sample"
        ? "Based on sample data created for the demo."
        : "Demo data, not a real record.";
  return (
    <Chip kind="sample" title={title} className={className}>
      {label}
    </Chip>
  );
}
