"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./Button";
import { IconButton } from "./IconButton";
import { SHEET_HANDLE } from "./styles";

type DialogPanelProps = {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  descriptionId?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Close handler for the Close button. */
  onClose?: () => void;
  /** Show the Close button (default: when onClose is given). */
  showClose?: boolean;
  className?: string;
};

/**
 * The dialog surface (level 3 content): max width 480, radius 12, padding 24, title text-title,
 * footer actions right-aligned. On phone a bottom sheet with a drag handle and safe-area padding.
 */
export function DialogPanel({ title, titleId, description, descriptionId, children, footer, onClose, showClose = !!onClose, className }: DialogPanelProps) {
  return (
    <div
      className={cn(
        "relative z-10 flex max-h-[calc(100dvh-32px)] w-full max-w-dialog flex-col overflow-y-auto bg-surface text-fg-1 shadow-pop",
        "rounded-lg p-6",
        "max-md:max-w-none max-md:rounded-b-none max-md:px-4 max-md:pb-[calc(16px+env(safe-area-inset-bottom))] max-md:pt-2",
        className,
      )}
    >
      <span aria-hidden="true" className={cn(SHEET_HANDLE, "mb-3")} />
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-title">
          {title}
        </h2>
        {showClose && <IconButton icon={X} label="Close" size="sm" className="-mr-1.5 -mt-0.5" onClick={onClose} />}
      </div>
      {description && (
        <p id={descriptionId} className="mt-1 text-small text-fg-2">
          {description}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
      {footer && <div className="mt-6 flex flex-wrap justify-end gap-2 max-md:[&>*]:flex-1">{footer}</div>}
    </div>
  );
}

export type DialogProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions, right-aligned: secondary then primary. A function receives close(). */
  footer?: ReactNode | ((close: () => void) => ReactNode);
  /** Controlled mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Uncontrolled mode: renders a Button with this content that opens the dialog. */
  trigger?: ReactNode;
  triggerVariant?: ButtonVariant;
  triggerClassName?: string;
  /** Esc and the scrim close the dialog (default). Turn off for destructive confirmations. */
  dismissible?: boolean;
  className?: string;
};

/**
 * Dialog / Sheet (§8.1). Native <dialog> opened with showModal(): focus is trapped, Esc closes
 * (unless not dismissible), the --overlay scrim closes, and focus returns to the trigger.
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
        aria-labelledby={open ? titleId : undefined}
        aria-describedby={open && description ? descId : undefined}
        onCancel={(e) => {
          e.preventDefault();
          if (dismissible) setOpen(false);
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-fg-1 backdrop:bg-transparent open:flex open:items-center open:justify-center max-md:open:items-end"
      >
        <div aria-hidden="true" className="absolute inset-0 bg-overlay" onClick={() => dismissible && setOpen(false)} />
        {open && (
          <DialogPanel
            title={title}
            titleId={titleId}
            description={description}
            descriptionId={descId}
            footer={typeof footer === "function" ? footer(() => setOpen(false)) : footer}
            onClose={dismissible ? () => setOpen(false) : undefined}
            className={cn("animate-pop-in md:mx-4", className)}
          >
            {children}
          </DialogPanel>
        )}
      </dialog>
    </>
  );
}
