import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASSES, Field, fieldDescribedBy } from "./Field";

export type InputProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  /** With a label the input renders inside a Field (label, help, error). */
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
};

/** Text input: 36px desktop / 44px phone, radius 6, 1px --control border, Iris border + halo on focus. */
export function Input({ id, label, help, error, className, fieldClassName, required, ...rest }: InputProps) {
  const input = (
    <input
      id={id}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={fieldDescribedBy(id, help, error)}
      className={cn(CONTROL_CLASSES, "h-9 max-md:h-11", className)}
      {...rest}
    />
  );
  if (!label) return input;
  return (
    <Field id={id} label={label} help={help} error={error} required={required} className={fieldClassName}>
      {input}
    </Field>
  );
}
