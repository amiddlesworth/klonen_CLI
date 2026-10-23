import type { ComponentProps, Ref } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { Kbd } from "./Kbd";

export type SearchFieldProps = Omit<ComponentProps<"input">, "size" | "type"> & {
  /**
   * "nav": 32px, 256px wide (280px from 1280px), "/" hint (from 1280px; at 1081–1279 the field is
   *   too narrow for the hint and the full placeholder, so the hint and padding give way).
   * "mobile": 40px visual with a 44px hit area, flexes, 16px text.
   * "block": 36px (44px on phone), full width, for in-page search boxes.
   */
  variant?: "nav" | "mobile" | "block";
  /** Show the "/" shortcut hint (nav variant). */
  shortcutHint?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
  /** Attributes for the wrapping label (e.g. data-force for documentation of states). */
  wrapperProps?: Omit<ComponentProps<"label">, "className" | "children">;
};

const WRAPPER = {
  nav: "h-8 w-64 xl:w-70 pl-2.5 pr-1.5 lg:max-xl:gap-1.5 lg:max-xl:pl-2 lg:max-xl:pr-1",
  mobile: "h-10 min-w-0 flex-1 pl-2.5 pr-2 before:absolute before:inset-x-0 before:-inset-y-0.5",
  block: "h-9 w-full pl-2.5 pr-2 max-md:h-11",
};

/**
 * Search field (§8.1): --hover fill, no border at rest, 1px --border on hover,
 * Iris border + 3px --accent-subtle halo on focus; 16px search icon.
 */
export function SearchField({
  variant = "nav",
  shortcutHint = variant === "nav",
  inputRef,
  wrapperClassName,
  wrapperProps,
  className,
  placeholder = "Search coaches and programs",
  ...rest
}: SearchFieldProps) {
  return (
    <label
      {...wrapperProps}
      className={cn(
        "relative flex shrink-0 cursor-text items-center gap-2 rounded-sm border border-transparent bg-hover text-fg-3 transition-colors focus-visible:outline-none",
        "hover:border-border focus-within:border-accent focus-within:bg-surface focus-within:shadow-[0_0_0_3px_var(--accent-subtle)]",
        WRAPPER[variant],
        wrapperClassName,
      )}
    >
      <Icon icon={Search} size={16} />
      <input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        aria-label={rest["aria-label"] ?? placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          // A placeholder that does not fit ends in an ellipsis instead of being cut mid-glyph.
          "relative h-full w-0 min-w-0 flex-1 truncate bg-transparent text-small text-fg-1 placeholder:text-fg-3 focus-visible:outline-none",
          variant !== "nav" && "max-md:text-base",
          className,
        )}
        {...rest}
      />
      {shortcutHint && <Kbd className={variant === "nav" ? "lg:max-xl:hidden" : undefined}>/</Kbd>}
    </label>
  );
}
