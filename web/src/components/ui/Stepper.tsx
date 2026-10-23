import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type StepperProps = {
  /** Step labels in order ("Confirm identity", "Review your career", "Publish"). */
  steps: readonly string[];
  /** 0-based index of the current step; steps.length when every step is done. */
  current: number;
  /** Accessible name of the progress nav ("Claim progress"). */
  label: string;
  className?: string;
};

/**
 * Stepper (§8.11, audit X15; claim flow and Post a job): 13/500 labels. The current step is --fg-1
 * with a 24px ink number disc, done steps show a check on --hover, upcoming steps are --fg-3 with an
 * outlined disc; aria-current="step". Desktop: one row joined by hairlines. Phone: equal columns,
 * disc over label, so every label stays visible at 390px. Pages put it in a band under the page
 * header (a --divider line above, 12px / 16px padding).
 */
export function Stepper({ steps, current, label, className }: StepperProps) {
  const last = steps.length - 1;
  return (
    <nav aria-label={label} className={className}>
      <ol style={{ "--steps": steps.length } as CSSProperties} className="grid grid-cols-[repeat(var(--steps),minmax(0,1fr))] gap-2 md:flex md:items-center md:gap-3">
        {steps.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li
              key={step}
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
                  state === "current" && "bg-badge-bg text-badge-fg",
                  state === "done" && "bg-hover text-fg-1",
                  state === "upcoming" && "shadow-[inset_0_0_0_1px_var(--control)]",
                )}
              >
                {state === "done" ? <Icon icon={Check} size={14} strokeWidth={2.25} /> : i + 1}
              </span>
              <span className="min-w-0 md:whitespace-nowrap">
                {step}
                <span className="sr-only">{state === "done" ? ", done" : state === "current" ? `, step ${i + 1} of ${steps.length}` : ", not started"}</span>
              </span>
              {i < last && <span aria-hidden="true" className="ml-1 hidden h-px min-w-6 flex-1 bg-divider md:block" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The band a Stepper sits in, under the page header inside the first card (bleeds to its edges). */
export const STEPPER_BAND = "border-t border-divider px-4 py-3 md:px-6 md:py-4";
