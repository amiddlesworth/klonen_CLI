import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Context line (§8.3): 12/16 --fg-3 with an optional 12px --fg-2 icon naming the reason type
 * (network = tree, graduation-cap = school, flag = player relationship, info = status).
 * "Via Rob Hutchins · coached him at Colorado", "Played for Ian 2024–25".
 */
export function ContextLine({ icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <p className={cn("mt-0.5 flex items-start gap-1 text-caption text-fg-3", className)}>
      {icon && <Icon icon={icon} size={12} className="mt-0.5 text-fg-2" />}
      <span className="min-w-0">{children}</span>
    </p>
  );
}
