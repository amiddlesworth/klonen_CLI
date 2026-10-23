import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type DisclosureProps = {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
};

/**
 * Disclosure (§8.1): native <details>. Summary 12px --fg-3 with a 12px chevron that rotates 90°
 * when open, 24px target; on phone the hit area grows to 44px tall (a toggle, §11 rule 7) without
 * changing the visual. Used for "Source" on every stint.
 */
export function Disclosure({ summary, children, defaultOpen, className, contentClassName }: DisclosureProps) {
  return (
    <details open={defaultOpen} className={cn("group/disc", className)}>
      <summary className="relative inline-flex min-h-6 items-center gap-1 rounded-xs text-caption text-fg-3 transition-colors hover:text-fg-1 max-md:before:absolute max-md:before:-inset-x-2 max-md:before:-inset-y-2.5">
        <Icon icon={ChevronRight} size={12} className="transition-transform duration-[120ms] group-open/disc:rotate-90" />
        {summary}
      </summary>
      <div className={cn("pt-1", contentClassName)}>{children}</div>
    </details>
  );
}
