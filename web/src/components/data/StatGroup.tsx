import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export type Stat = {
  value: ReactNode;
  label: string;
  /** A linked stat: label in --link 500 with a 12px chevron, underlined on hover. */
  href?: string;
  /** Drop this stat on phone (e.g. "First season" in the profile header). */
  hideOnPhone?: boolean;
  /** Next to the label, e.g. a dashed "Sample" chip. */
  adornment?: ReactNode;
};

type StatGroupProps = {
  stats: Stat[];
  /**
   * "header": top divider, 14/16px padding (profile and program headers).
   * "kpi": top and bottom dividers, bled to a 16px-padded card's edges (tracker KPIs).
   * "inline": top and bottom dividers inside a feed item (milestones).
   */
  variant?: "header" | "kpi" | "inline";
  /** Accessible name of the group ("Career stats"). */
  label?: string;
  className?: string;
};

const CELL = {
  header: "py-3.5 pr-4 max-md:py-3 max-md:pr-1 [&+&]:pl-5 max-md:[&+&]:pl-2.5",
  kpi: "px-4 pb-3 pt-2.5",
  inline: "py-2.5 pr-3 [&+&]:pl-4 max-md:[&+&]:pl-3",
};

/**
 * Stat band (§8.3): equal columns split by 1px --divider; each value text-stat tabular (stat-sm on
 * phone) over a 12px --fg-2 label. Screen readers hear the label first, then the value.
 */
export function StatGroup({ stats, variant = "header", label, className }: StatGroupProps) {
  const n = stats.length;
  const nPhone = stats.filter((s) => !s.hideOnPhone).length;
  return (
    <div
      role="group"
      aria-label={label}
      style={{ "--n": n, "--np": nPhone } as CSSProperties}
      className={cn(
        "grid grid-cols-[repeat(var(--n),minmax(0,1fr))] border-t border-divider max-md:grid-cols-[repeat(var(--np),minmax(0,1fr))]",
        variant !== "header" && "border-b",
        variant === "kpi" && "-mx-4",
        className,
      )}
    >
      {stats.map((s, i) => {
        const body = (
          <>
            <span className="order-2 flex flex-wrap items-center gap-1 text-caption">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 whitespace-nowrap underline-offset-2",
                  s.href ? "font-medium text-link group-hover/stat:underline" : "text-fg-2",
                )}
              >
                {s.label}
                {s.href && <Icon icon={ChevronRight} size={12} />}
              </span>
              {s.adornment}
            </span>
            <span className="num order-1 text-stat max-md:text-stat-sm">{s.value}</span>
          </>
        );
        const cls = cn("group/stat flex min-w-0 flex-col [&+&]:border-l [&+&]:border-divider", CELL[variant], s.hideOnPhone && "max-md:hidden");
        return s.href ? (
          <Link key={i} href={s.href} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={i} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
