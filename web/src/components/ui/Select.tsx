import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASSES, Field, fieldDescribedBy } from "./Field";
import { Icon } from "./Icon";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<ComponentProps<"select">, "id" | "children"> & {
  id: string;
  options: SelectOption[];
  /** Adds an empty first option with this text. */
  placeholder?: string;
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
};

/** Native select styled like Input, with a 16px chevron. */
export function Select({ id, options, placeholder, label, help, error, className, fieldClassName, required, ...rest }: SelectProps) {
  const select = (
    <span className="relative flex min-w-0">
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, help, error)}
        className={cn(CONTROL_CLASSES, "h-9 appearance-none pr-9 max-md:h-11", className)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon icon={ChevronDown} size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-2" />
    </span>
  );
  if (!label) return select;
  return (
    <Field id={id} label={label} help={help} error={error} required={required} className={fieldClassName}>
      {select}
    </Field>
  );
}
