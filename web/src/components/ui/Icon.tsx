import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Icon sizes and their stroke widths (DESIGN.md §7). */
export type IconSize = 12 | 14 | 16 | 20 | 22;

const STROKE: Record<IconSize, number> = { 12: 2, 14: 1.9, 16: 1.75, 20: 1.75, 22: 1.6 };

export type IconProps = {
  icon: LucideIcon;
  size?: IconSize;
  /** Override the stroke for the size (e.g. 2.1 for the active tab-bar icon). */
  strokeWidth?: number;
  className?: string;
};

/** A Lucide outline icon. Always decorative: the control around it carries the name. */
export function Icon({ icon: Glyph, size = 16, strokeWidth, className }: IconProps) {
  return <Glyph size={size} strokeWidth={strokeWidth ?? STROKE[size]} aria-hidden="true" focusable="false" className={cn("shrink-0", className)} />;
}
