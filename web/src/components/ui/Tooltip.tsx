"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { TOOLTIP_BUBBLE } from "./styles";

type TooltipProps = {
  /** Short text, usually the control's accessible name. */
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
};

/**
 * Tooltip (§8.1): --fg-1 fill, --surface text 12/16, radius 4, padding 4 8, 400ms delay,
 * on hover and keyboard focus. Not on touch: a tap focuses the button on Android, so focus shows
 * the tooltip only when it is :focus-visible (keyboard), and touch pointers never trigger hover.
 * Decorative: the wrapped control must already carry its name.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<{ top: number; left: number; side: "top" | "bottom" } | null>(null);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const s = side === "top" && r.top < 40 ? "bottom" : side;
      const left = Math.max(48, Math.min(r.left + r.width / 2, window.innerWidth - 48));
      setPos({ top: s === "top" ? r.top - 6 : r.bottom + 6, left, side: s });
    }, 400);
  }, [side]);

  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos, hide]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={anchor}
      className={cn("inline-flex", className)}
      onPointerEnter={(e) => e.pointerType !== "touch" && show()}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        const t = e.target as Element;
        if (t.matches(":focus-visible")) show();
      }}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className={cn(
              TOOLTIP_BUBBLE,
              "pointer-events-none fixed z-[70] -translate-x-1/2 animate-pop-in",
              pos.side === "top" && "-translate-y-full",
            )}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
