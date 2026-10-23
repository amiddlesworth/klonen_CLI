"use client";
import { useLayoutEffect, useState, type RefObject } from "react";

export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

/**
 * Fixed-position coordinates for a floating panel (menu, popover) anchored to a trigger.
 * Flips vertically when there is no room and keeps an 8px margin from the viewport edges.
 */
export function useAnchoredPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  floatRef: RefObject<HTMLElement | null>,
  placement: Placement = "bottom-start",
  offset = 4,
): { top: number; left: number } | null {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = floatRef.current;
      if (!anchor || !panel) return;
      const fw = panel.offsetWidth;
      const fh = panel.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const m = 8;
      const [side, align] = placement.split("-") as ["bottom" | "top", "start" | "end"];
      const below = anchor.bottom + offset;
      const above = anchor.top - offset - fh;
      let top = side === "bottom" ? below : above;
      if (side === "bottom" && below + fh > vh - m && above > m) top = above;
      if (side === "top" && above < m && below + fh < vh - m) top = below;
      let left = align === "end" ? anchor.right - fw : anchor.left;
      left = Math.max(m, Math.min(left, vw - fw - m));
      setPos({ top: Math.round(top), left: Math.round(left) });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, floatRef, placement, offset]);

  return pos;
}

/** Calls onOutside when a pointer goes down outside every given element. */
export function useOutsidePointer(active: boolean, refs: RefObject<HTMLElement | null>[], onOutside: () => void) {
  useLayoutEffect(() => {
    if (!active) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      onOutside();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [active, refs, onOutside]);
}
