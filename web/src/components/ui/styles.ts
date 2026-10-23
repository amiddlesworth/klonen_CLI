/** Shared surface classes (plain strings, safe to import from server and client components). */

/** Level 2 menu panel: --surface + shadow-pop, radius 8, 4px padding. */
export const MENU_PANEL = "rounded-md bg-surface p-1 text-fg-1 shadow-pop outline-none";

/** Tooltip bubble: --fg-1 fill, --surface text 12/16, radius 4, padding 4 8. */
export const TOOLTIP_BUBBLE = "whitespace-nowrap rounded-xs bg-fg-1 px-2 py-1 text-caption text-surface";

/** Bottom-sheet chrome on phone (§8.1 Dialog / Sheet): radius 12 12 0 0, safe-area padding. */
export const SHEET_PHONE = "max-md:rounded-b-none max-md:rounded-t-lg max-md:pb-[calc(8px+env(safe-area-inset-bottom))]";

/** The sheet's drag handle (32×4 --border-strong), phone only. */
export const SHEET_HANDLE = "mx-auto block h-1 w-8 shrink-0 rounded-full bg-border-strong md:hidden";
