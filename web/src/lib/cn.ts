import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge, taught this design system's theme (globals.css @theme). Without it,
 * tailwind-merge would read the custom text sizes ("text-caption") as colors and drop one of
 * "text-caption text-fg-3", and would not know which custom values conflict.
 */

/** Font sizes (`--text-*`, DESIGN §2.4 / §4). */
export const TEXT_SIZES = ["hero", "hero-sm", "display", "display-sm", "stat", "stat-sm", "title", "subtitle", "body", "prose", "small", "caption"];

/** Color tokens (`--color-*`, DESIGN §2.1). Tailwind's palette is dropped, so these are the only colors. */
export const COLOR_TOKENS = [
  "canvas", "surface", "surface-2", "hover", "pressed",
  "border", "divider", "border-strong", "control",
  "fg-1", "fg-2", "fg-3", "fg-disabled",
  "accent", "accent-hover", "accent-pressed", "accent-subtle", "on-accent",
  "link", "focus", "danger", "danger-hover", "danger-pressed", "danger-subtle",
  "badge-bg", "badge-fg", "org-bg", "org-fg",
  "lvl-head", "lvl-coord", "lvl-pos", "bar", "track", "overlay",
  "av1-bg", "av1-fg", "av2-bg", "av2-fg", "av3-bg", "av3-fg", "av4-bg", "av4-fg", "av5-bg", "av5-fg", "av6-bg", "av6-fg",
  "transparent", "current", "inherit",
];

const twMerge = extendTailwindMerge({
  override: {
    // Only the tokens are colors, so an unknown word after text-/bg-/border- is never taken for one.
    theme: { color: COLOR_TOKENS },
    // Tailwind v4 text sizes set line-height through var(--tw-leading, …), so a leading-* class
    // wins whatever its order. Keep it when a size follows, as the stylesheet would.
    conflictingClassGroups: { "font-size": [] },
  },
  extend: {
    theme: {
      text: TEXT_SIZES,
      shadow: ["pop", "btn"],
      container: ["page", "main", "prose", "dialog"],
      animate: ["pop-in", "spin-700"],
    },
  },
});

/**
 * Joins class names (clsx) and resolves Tailwind conflicts (tailwind-merge): when two classes set
 * the same property, the later argument wins, whatever the order of rules in the stylesheet. So a
 * primitive's `className` prop reliably overrides its defaults: cn("text-fg-1", "text-danger")
 * gives "text-danger", while cn("text-caption", "text-fg-3") keeps both (size and color).
 */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}
