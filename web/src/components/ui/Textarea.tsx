import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASSES, Field, fieldDescribedBy } from "./Field";

export type TextareaProps = Omit<ComponentProps<"textarea">, "id"> & {
  id: string;
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
};

/** Textarea: at least 3 rows, resizes vertically. */
export function Textarea({ id, label, help, error, className, fieldClassName, required, rows = 3, ...rest }: TextareaProps) {
  const textarea = (
    <textarea
      id={id}
      rows={rows}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={fieldDescribedBy(id, help, error)}
      className={cn(CONTROL_CLASSES, "min-h-[76px] resize-y py-2 leading-5", className)}
      {...rest}
    />
  );
  if (!label) return textarea;
  return (
    <Field id={id} label={label} help={help} error={error} required={required} className={fieldClassName}>
      {textarea}
    </Field>
  );
}
