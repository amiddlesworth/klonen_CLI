"use client";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useAnchoredPosition, useOutsidePointer, type Placement } from "./floating";

type PopoverProps = {
  trigger: ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  /** Accessible name of the panel. */
  label: string;
  placement?: Placement;
  width?: number;
  panelClassName?: string;
  children: ReactNode;
};

/**
 * Popover: a level 2 floating panel (role="dialog", non-modal) for content that is not a list of
 * actions (filters, previews). Esc and click outside close it; focus returns to the trigger on Esc.
 */
export function Popover({ trigger, triggerLabel, triggerClassName, label, placement = "bottom-start", width, panelClassName, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const pos = useAnchoredPosition(open, triggerRef, panelRef, placement);
  const outsideRefs = useRef([triggerRef, panelRef]).current;
  const close = useCallback(() => setOpen(false), []);
  useOutsidePointer(open, outsideRefs, close);

  useEffect(() => {
    if (open && pos) panelRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus once when positioned
  }, [open, pos === null]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={triggerLabel}
        onClick={() => setOpen(!open)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
              }
            }}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, visibility: pos ? "visible" : "hidden" }}
            className={cn(
              "fixed z-40 max-w-[calc(100vw-16px)] rounded-md bg-surface p-3 text-fg-1 shadow-pop outline-none animate-pop-in",
              panelClassName,
            )}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
