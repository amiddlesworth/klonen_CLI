import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  id: string;
  title: ReactNode;
  /** One 13px --fg-2 line under the title. */
  description?: ReactNode;
  /** At most one link on the right ("Search all coaches →"); wraps under the title on phone. */
  action?: ReactNode;
  className?: string;
};

/**
 * Heading row for a landing section that sits on the canvas: h2 20/28 600, an optional line under
 * it and one link on the right. Not a card, so it brings its own 16px gutter on phone.
 */
export function SectionHeader({ id, title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 px-4 md:px-0", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-display-sm">
          {title}
        </h2>
        {description && <p className="mt-0.5 max-w-prose text-small text-fg-2">{description}</p>}
      </div>
      {action && <div className="shrink-0 pb-px">{action}</div>}
    </div>
  );
}
