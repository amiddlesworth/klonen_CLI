import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Keyboard hint ("/", "↵"): 12px --fg-3 on --surface with an inset --border-strong ring, radius 4. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        "inline-block min-w-[18px] shrink-0 rounded-xs bg-surface px-1 text-center font-sans text-caption text-fg-3 shadow-[inset_0_0_0_1px_var(--border-strong)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
