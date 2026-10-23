import type { ComponentProps, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type ChoiceProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  label: ReactNode;
  /** Optional second line (12px --fg-3). */
  description?: ReactNode;
  /** Right-aligned count (search facets). */
  count?: number;
};

const ROW =
  "group/choice flex min-h-8 cursor-pointer items-center gap-2 text-small text-fg-1 max-md:min-h-11 has-[:disabled]:cursor-not-allowed has-[:disabled]:text-fg-disabled";

const BOX =
  "peer size-4 shrink-0 appearance-none border-[1.5px] border-control bg-surface transition-colors " +
  "checked:border-accent disabled:border-transparent disabled:bg-hover";

function Text({ label, description, count }: { label: ReactNode; description?: ReactNode; count?: number }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {description && <span className="block text-caption text-fg-3">{description}</span>}
      </span>
      {count !== undefined && <span className="num text-caption text-fg-3">{count}</span>}
    </>
  );
}

/** Checkbox (§8.1): 16px box, radius 4, 1.5px --control border; checked = Iris with a white check. The whole row is the target. */
export function Checkbox({ label, description, count, className, ...rest }: ChoiceProps) {
  return (
    <label className={cn(ROW, description && "items-start py-1", className)}>
      <span className={cn("relative grid place-items-center", description && "mt-0.5")}>
        <input type="checkbox" className={cn(BOX, "rounded-xs checked:bg-accent")} {...rest} />
        <Icon icon={Check} size={12} strokeWidth={3} className="pointer-events-none absolute hidden text-on-accent peer-checked:block" />
      </span>
      <Text label={label} description={description} count={count} />
    </label>
  );
}

/** Radio (§8.1): 16px circle; checked = Iris ring with a white dot. */
export function Radio({ label, description, count, className, ...rest }: ChoiceProps) {
  return (
    <label className={cn(ROW, description && "items-start py-1", className)}>
      <input type="radio" className={cn(BOX, "rounded-full checked:border-[5px] checked:bg-on-accent", description && "mt-0.5")} {...rest} />
      <Text label={label} description={description} count={count} />
    </label>
  );
}

/** Group of checkboxes or radios with a 13/600 label. */
export function ChoiceGroup({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-1 text-small font-semibold text-fg-1">{label}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Switch (§8.1): 32×20; off = --control outline with a --fg-3 knob, on = Iris track with a white knob.
 * The label row is the target (≥ 44px on phone).
 */
export function Switch({ label, description, className, ...rest }: Omit<ChoiceProps, "count">) {
  return (
    <label className={cn(ROW, "justify-between gap-3", className)}>
      <Text label={label} description={description} />
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer h-5 w-8 appearance-none rounded-full border-[1.5px] border-control bg-transparent transition-colors checked:border-accent checked:bg-accent disabled:border-transparent disabled:bg-hover"
          {...rest}
        />
        <span className="pointer-events-none absolute left-1 top-1 size-3 rounded-full bg-fg-3 transition-transform peer-checked:translate-x-3 peer-checked:bg-on-accent peer-disabled:bg-fg-disabled" />
      </span>
    </label>
  );
}
