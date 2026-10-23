"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./Button";
import { IconButton } from "./IconButton";

export type DialogProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions, right-aligned: secondary then primary. */
  footer?: ReactNode;
  /** Controlled mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Uncontrolled mode: renders a Button that opens the dialog. */
  trigger?: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  /** Esc and the scrim close the dialog (default). Turn off for destructive confirmations. */
  dismissible?: boolean;
  className?: string;
};

/**
 * Dialog / Sheet (§8.1): max width 480, radius 12, padding 24, title text-title; on phone a bottom
 * sheet (radius 12 12 0 0, drag handle, safe-area padding). Scrim --overlay. Native <dialog> modal:
 * focus is trapped, Esc closes (unless not dismissible), focus returns to the trigger.
 */
export function Dialog({
  title,
  description,
  children,
  footer,
  open: openProp,
  onOpenChange,
  trigger,
  triggerVariant = "secondary",
  triggerClassName,
  dismissible = true,
  className,
}: DialogProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
      returnTo.current?.focus?.();
    }
  }, [open]);

  return (
    <>
      {trigger !== undefined && (
        <Button variant={triggerVariant} className={triggerClassName} onClick={() => setOpen(true)}>
          {trigger}
        </Button>
      )}
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onCancel={(e) => {
          e.preventDefault();
          if (dismissible) setOpen(false);
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-fg-1 backdrop:bg-transparent open:flex open:items-center open:justify-center max-md:open:items-end"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-overlay" onClick={() => dismissible && setOpen(false)} />
        <div
          className={cn(
            "relative z-10 flex max-h-[calc(100dvh-32px)] w-full max-w-dialog flex-col overflow-y-auto bg-surface shadow-pop animate-pop-in",
            "rounded-lg p-6 md:mx-4",
            "max-md:max-w-none max-md:rounded-b-none max-md:px-4 max-md:pt-2 max-md:pb-[calc(16px+env(safe-area-inset-bottom))]",
            className,
          )}
        >
          <span aria-hidden="true" className="mx-auto mb-3 h-1 w-8 rounded-full bg-border-strong md:hidden" />
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-title">
              {title}
            </h2>
            {dismissible && <IconButton icon={X} label="Close" size="sm" className="-mr-1.5 -mt-0.5" onClick={() => setOpen(false)} />}
          </div>
          {description && (
            <p id={descId} className="mt-1 text-small text-fg-2">
              {description}
            </p>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2 max-md:[&>*]:flex-1">{footer}</div>}
        </div>
      </dialog>
    </>
  );
}
