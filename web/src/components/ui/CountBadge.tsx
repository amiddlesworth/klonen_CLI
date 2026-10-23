import { cn } from "@/lib/cn";

/**
 * Count badge (§8.1): 18px ink pill (never Iris) with a 2px --surface ring, at the icon's top-right.
 * Decorative: put the count in the parent's accessible name ("Notifications, 5 new").
 * Position it with className (e.g. "-top-1.5 left-3" over a 20px icon).
 */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute h-[18px] min-w-[18px] rounded-full bg-badge-bg px-[5px] text-center text-caption font-semibold leading-[18px] text-badge-fg tabular-nums shadow-[0_0_0_2px_var(--surface)]",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** "Notifications, 5 new" style accessible names for controls with a count. */
export function withCount(label: string, count: number, noun = "new"): string {
  return count > 0 ? `${label}, ${count > 99 ? "99+" : count} ${noun}` : label;
}
