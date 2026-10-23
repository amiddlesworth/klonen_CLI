"use client";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { MENU_PANEL, SHEET_HANDLE, SHEET_PHONE } from "./styles";
import { useAnchoredPosition, useOutsidePointer, type Placement } from "./floating";
import { Tooltip } from "./Tooltip";

const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]';

/** A menu panel rendered in place (documentation and previews). Items are not keyboard-managed. */
export function MenuSurface({ label, minWidth = 200, className, children }: { label: string; minWidth?: number; className?: string; children: ReactNode }) {
  return (
    <div role="menu" aria-label={label} style={{ minWidth }} className={cn(MENU_PANEL, className)}>
      {children}
    </div>
  );
}

export type MenuProps = {
  /** Content of the trigger button (icon, avatar, label). */
  trigger: ReactNode;
  /** Accessible name of the trigger (required when the trigger has no visible text). */
  triggerLabel?: string;
  /** Show triggerLabel as a tooltip (icon-only triggers). */
  tooltip?: boolean;
  triggerClassName?: string;
  /** Extra attributes for the trigger (aria-current, data-*). */
  triggerProps?: Record<string, string | boolean | undefined>;
  /** Accessible name of the menu panel (defaults to triggerLabel). */
  label?: string;
  placement?: Placement;
  /** Panel min width in px (default 200). */
  minWidth?: number;
  panelClassName?: string;
  children: ReactNode;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Below 721px, open as a bottom sheet (full width, drag handle, safe-area padding, over the
   * --overlay scrim) instead of a floating panel. Menu semantics and keys are unchanged.
   */
  sheetOnPhone?: boolean;
  /**
   * Open with focus on the checked item instead of the first one. Only for menus that are a single
   * radio group (a sort or scope picker); mixed menus such as the Me menu start at the top.
   */
  focusChecked?: boolean;
};

/**
 * Menu (§8.1): level 2 panel (surface + shadow-pop), radius 8, 4px padding, min width 200.
 * role="menu", arrow keys/Home/End, Esc returns focus to the trigger, click outside closes.
 * Items: MenuItem, MenuLink, MenuRadioItem, MenuGroup, MenuDivider, MenuHeader.
 */
export function Menu({
  trigger,
  triggerLabel,
  tooltip = false,
  triggerClassName,
  triggerProps,
  label,
  placement = "bottom-end",
  minWidth = 200,
  panelClassName,
  children,
  open: openProp,
  onOpenChange,
  sheetOnPhone = false,
  focusChecked = false,
}: MenuProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = useCallback(
    (v: boolean) => {
      setOpenState(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const id = useId();
  const pos = useAnchoredPosition(open, triggerRef, panelRef, placement);

  const items = () =>
    Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []).filter(
      (el) => el.getAttribute("aria-disabled") !== "true" && el.getClientRects().length > 0,
    );

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [setOpen],
  );

  useEffect(() => {
    if (!open || !pos) return;
    // Menu pattern: the first item (the last after ArrowUp on the trigger); the checked item only
    // for single radio-group menus that opt in.
    const list = items();
    const checked = focusChecked ? list.find((el) => el.getAttribute("aria-checked") === "true") : undefined;
    const target = focusOnOpen.current === "last" ? list[list.length - 1] : (checked ?? list[0]);
    target?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus once when the panel is positioned
  }, [open, pos === null]);

  const outsideRefs = useRef([triggerRef, panelRef]).current;
  useOutsidePointer(open, outsideRefs, () => close(false));

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusOnOpen.current = e.key === "ArrowUp" ? "last" : "first";
      setOpen(true);
    }
  }

  function onPanelKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = (i + 1) % list.length;
    else if (e.key === "ArrowUp") next = (i - 1 + list.length) % list.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    } else if (e.key === "Tab") {
      close(false);
      return;
    } else if ((e.key === " " || e.key === "Enter") && i >= 0 && list[i].tagName !== "A" && list[i].tagName !== "BUTTON") {
      e.preventDefault();
      list[i].click();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      list[next]?.focus();
    }
  }

  function onPanelClick(e: MouseEvent<HTMLDivElement>) {
    const item = (e.target as Element).closest(ITEM_SELECTOR);
    if (!item || item.getAttribute("aria-disabled") === "true" || item.hasAttribute("data-keep-open")) return;
    close(item.tagName !== "A");
  }

  const button = (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-label={triggerLabel}
      onClick={() => {
        focusOnOpen.current = "first";
        setOpen(!open);
      }}
      onKeyDown={onTriggerKeyDown}
      className={triggerClassName}
      {...triggerProps}
    >
      {trigger}
    </button>
  );

  return (
    <>
      {tooltip && triggerLabel ? <Tooltip content={triggerLabel}>{button}</Tooltip> : button}
      {open &&
        createPortal(
          <>
            {/* Sheet scrim (phone). A pointer down on it is outside the panel, so it closes the menu. */}
            {sheetOnPhone && <div aria-hidden="true" className="fixed inset-0 z-50 bg-overlay animate-pop-in md:hidden" />}
            <div
              ref={panelRef}
              id={id}
              role="menu"
              aria-label={label ?? triggerLabel}
              tabIndex={-1}
              onKeyDown={onPanelKeyDown}
              onClick={onPanelClick}
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, minWidth, visibility: pos ? "visible" : "hidden" }}
              className={cn(
                MENU_PANEL,
                "fixed z-40 max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain animate-pop-in",
                panelClassName,
                // Phone sheet: pinned to the bottom edge at full width (overrides the anchored position).
                sheetOnPhone && ["max-md:inset-x-0! max-md:top-auto! max-md:bottom-0! max-md:z-50 max-md:w-full! max-md:min-w-0! max-md:max-w-none! max-md:max-h-[85dvh]", SHEET_PHONE],
              )}
            >
              {sheetOnPhone && <span aria-hidden="true" className={cn(SHEET_HANDLE, "mb-1 mt-1")} />}
              {children}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
