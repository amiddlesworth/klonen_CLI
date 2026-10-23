import { cn } from "@/lib/cn";

type DividerProps = {
  orientation?: "horizontal" | "vertical";
  /** Bleed a horizontal divider to the card edge: "rail" = 16px padding, "main" = 16/24px. */
  bleed?: "none" | "rail" | "main";
  /** --divider (inside cards, default) or --border (nav and card edges). */
  tone?: "divider" | "border";
  className?: string;
};

const BLEED = { none: "", rail: "-mx-4", main: "-mx-4 md:-mx-6" };

/** 1px line. Inside cards use dividers, never a nested bordered box (§5.3). */
export function Divider({ orientation = "horizontal", bleed = "none", tone = "divider", className }: DividerProps) {
  const color = tone === "divider" ? "bg-divider" : "bg-border";
  if (orientation === "vertical") {
    return <span role="separator" aria-orientation="vertical" className={cn("w-px shrink-0 self-stretch", color, className)} />;
  }
  return <hr className={cn("h-px border-0", color, BLEED[bleed], className)} />;
}
