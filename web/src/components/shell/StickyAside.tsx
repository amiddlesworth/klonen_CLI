"use client";
import { useLayoutEffect, useRef, type ComponentProps } from "react";

type StickyAsideProps = ComponentProps<"aside"> & {
  /** Gap below the top nav when the rail fits the viewport (px, default 20). */
  offset?: number;
};

/**
 * A rail that is pinned only when it fits (§8.2: rails sit 16–20px below the nav). It sets
 * `--rail-top` to min(nav + offset, viewport − rail height − 16): a rail that fits pins under the
 * nav; a taller one gets a negative top, so it scrolls with the page until its bottom (the legal
 * footer) is in view and then pins there, as LinkedIn's rails do. Callers make it sticky at their
 * breakpoint with a top of var(--rail-top) plus a fallback for the first paint (see Layouts.tsx).
 * Recomputed on resize and whenever the rail's height changes.
 */
export function StickyAside({ offset = 20, ...rest }: StickyAsideProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 52;
      const top = Math.min(navH + offset, window.innerHeight - el.offsetHeight - 16);
      el.style.setProperty("--rail-top", `${Math.round(top)}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [offset]);

  return <aside ref={ref} {...rest} />;
}
