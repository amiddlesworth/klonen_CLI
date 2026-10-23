import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./Button";
import { CONTROL_FOCUS_WITHIN } from "./Field";
import { Icon } from "./Icon";

/**
 * The box of every in-page search (audit X20): --surface, 1px --control border (--fg-3 on hover),
 * radius 8, the form-control focus ring, a search icon, the input, and the submit button inside on
 * the right. The landing hero uses the same box at 48px (LandingSearch).
 */
export const PAGE_SEARCH_BOX = cn(
  "flex cursor-text items-center rounded-md border border-control bg-surface text-fg-3 transition-colors hover:border-fg-3",
  CONTROL_FOCUS_WITHIN,
);

type PageSearchFieldProps = Omit<ComponentProps<"input">, "type" | "size"> & {
  /** Accessible name of the input (the placeholder is not a label). */
  "aria-label": string;
  /** "primary" when the page has no other primary action; "secondary" when it has (Jobs: Apply). */
  buttonVariant?: Extract<ButtonVariant, "primary" | "secondary">;
  buttonLabel?: string;
  className?: string;
};

/**
 * In-page search field (audit X20; search start page, Jobs): the PAGE_SEARCH_BOX at 40px (48px on
 * phone, 16px text), 16px icon, the input and a submit button inside on the right. Put it in a GET
 * <form> (with any hidden inputs the page keeps); it works without JavaScript.
 */
export function PageSearchField({ buttonVariant = "primary", buttonLabel = "Search", className, ...input }: PageSearchFieldProps) {
  return (
    <label className={cn(PAGE_SEARCH_BOX, "h-10 gap-2 pl-3 pr-1 max-md:h-12", className)}>
      <Icon icon={Search} size={16} />
      <input
        type="search"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        {...input}
        className="h-full w-0 min-w-0 flex-1 truncate bg-transparent text-small text-fg-1 placeholder:text-fg-3 focus-visible:outline-none max-md:text-base"
      />
      <Button type="submit" variant={buttonVariant} className="shrink-0">
        {buttonLabel}
      </Button>
    </label>
  );
}
