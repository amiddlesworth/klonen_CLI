import type { ReactNode } from "react";
import { CircleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "./Button";
import { Icon } from "./Icon";

export type EmptyStateProps = {
  icon?: LucideIcon;
  /** One 14/500 sentence stating the fact ("No About yet."). */
  title: ReactNode;
  /** One 13px --fg-2 line on what happens next. */
  description?: ReactNode;
  /** At most one secondary button. */
  action?: ReactNode;
  /** Heading level for the title when it should be in the outline (default: a paragraph). */
  as?: "p" | "h1" | "h2" | "h3";
  align?: "center" | "start";
  /** Vertical padding: "md" inside a card section, "lg" when it is the whole card. */
  spacing?: "sm" | "md" | "lg";
  className?: string;
};

const SPACING = { sm: "py-4", md: "py-8", lg: "py-12" };

/** Empty state (§8.0): inside the card that would hold the content. No illustrations. */
export function EmptyState({ icon, title, description, action, as: Tag = "p", align = "center", spacing = "md", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col gap-1", align === "center" ? "items-center px-4 text-center" : "items-start", SPACING[spacing], className)}>
      {icon && <Icon icon={icon} size={20} className="mb-2 text-fg-3" />}
      <Tag className="text-body font-medium text-fg-1">{title}</Tag>
      {description && <p className="max-w-prose text-small text-fg-2">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export type ErrorStateProps = {
  /** One sentence. */
  message: ReactNode;
  /** "Try again" link target, or pass `action` for a client retry button. */
  retryHref?: string;
  action?: ReactNode;
  className?: string;
};

/** Inline error (§8.0): --danger icon + one sentence + a "Try again" ghost button. */
export function ErrorState({ message, retryHref, action, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-small text-fg-1", className)}>
      <Icon icon={CircleAlert} size={16} className="text-danger" />
      <span className="min-w-0 flex-1">{message}</span>
      {action ??
        (retryHref && (
          <ButtonLink href={retryHref} variant="ghost" size="sm">
            Try again
          </ButtonLink>
        ))}
    </div>
  );
}
