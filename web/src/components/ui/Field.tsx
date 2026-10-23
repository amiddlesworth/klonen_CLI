import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type FieldProps = {
  /** The control's id; the label points at it and help/error ids derive from it. */
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/** ids for aria-describedby on a control inside a Field. */
export function fieldDescribedBy(id: string, help?: ReactNode, error?: ReactNode): string | undefined {
  if (error) return `${id}-error`;
  if (help) return `${id}-help`;
  return undefined;
}

/**
 * Form field (§8.1): label 13/500 above (always visible), help 12px --fg-3 below,
 * or a 12px --danger message with an icon when invalid.
 */
export function Field({ id, label, help, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small font-medium text-fg-1">
        {label}
        {required && <span className="font-normal text-fg-3"> (required)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-caption text-danger">
          <Icon icon={CircleAlert} size={12} className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : (
        help && (
          <p id={`${id}-help`} className="text-caption text-fg-3">
            {help}
          </p>
        )
      )}
    </div>
  );
}

/** Shared look for Input, Textarea and Select (§8.1). */
export const CONTROL_CLASSES =
  "w-full min-w-0 rounded-sm border border-control bg-surface px-3 text-small text-fg-1 transition-colors placeholder:text-fg-3 " +
  "hover:border-fg-3 focus-visible:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-subtle)] " +
  "aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_3px_var(--danger-subtle)] " +
  "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-hover disabled:text-fg-disabled " +
  "max-md:text-base";
