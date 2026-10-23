import { Check } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export const CLAIM_STEPS = ["Confirm identity", "Review your career", "Publish"] as const;

type ClaimStepperProps = {
  /** 0-based index of the current step; CLAIM_STEPS.length when every step is done. */
  current: number;
  className?: string;
};

/**
 * Claim stepper (§8.11): three steps, 13/500. The current step is --fg-1 with an ink number disc,
 * done steps show a check, upcoming steps are --fg-3. Desktop: one row joined by hairlines.
 * Phone: three equal columns, disc over label, so every label stays visible at 390px.
 */
export function ClaimStepper({ current, className }: ClaimStepperProps) {
  const last = CLAIM_STEPS.length - 1;
  return (
    <nav aria-label="Claim progress" className={className}>
      <ol className="grid grid-cols-3 gap-2 md:flex md:items-center md:gap-3">
        {CLAIM_STEPS.map((label, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1.5 text-center text-small font-medium md:flex-row md:gap-2 md:text-left",
                i < last && "md:flex-1",
                state === "upcoming" ? "text-fg-3" : "text-fg-1",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "num grid size-6 shrink-0 place-items-center rounded-full text-caption font-semibold",
                  state === "current" && "bg-fg-1 text-surface",
                  state === "done" && "bg-hover text-fg-1",
                  state === "upcoming" && "shadow-[inset_0_0_0_1px_var(--control)]",
                )}
              >
                {state === "done" ? <Icon icon={Check} size={14} strokeWidth={2.25} /> : i + 1}
              </span>
              <span className="min-w-0 md:whitespace-nowrap">
                {label}
                <span className="sr-only">
                  {state === "done" ? ", done" : state === "current" ? `, step ${i + 1} of ${CLAIM_STEPS.length}` : ", not started"}
                </span>
              </span>
              {i < last && <span aria-hidden="true" className="ml-1 hidden h-px min-w-6 flex-1 bg-divider md:block" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
