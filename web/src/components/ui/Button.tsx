import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";
/**
 * Phone sizing (≤ 720px): "default" = 40px visual with a 44px hit area, "large" = 44px
 * (header and job-card actions), "none" = keep the desktop size (caller sizes it).
 */
export type ButtonPhone = "default" | "large" | "none";

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  phone?: ButtonPhone;
  iconOnly?: boolean;
  fullWidth?: boolean;
};

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent " +
  "text-small font-medium leading-none transition-colors " +
  "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed " +
  "disabled:bg-hover! disabled:text-fg-disabled! disabled:border-transparent! disabled:shadow-none! " +
  "aria-disabled:bg-hover! aria-disabled:text-fg-disabled! aria-disabled:border-transparent! aria-disabled:shadow-none!";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
  secondary: "bg-surface text-fg-1 border-control shadow-btn hover:bg-hover active:bg-pressed",
  ghost: "bg-transparent text-fg-2 hover:bg-hover hover:text-fg-1 active:bg-pressed",
  // White text on the light-theme danger red; --surface keeps 4.5:1 on the lighter dark-theme red.
  danger: "bg-danger text-surface hover:opacity-90 active:opacity-80",
};

const SIZE: Record<ButtonSize, string> = { sm: "h-7 px-2.5", md: "h-8 px-3" };
const ICON_ONLY: Record<ButtonSize, string> = { sm: "w-7 px-0", md: "w-8 px-0" };

const PHONE: Record<ButtonPhone, string> = {
  default: "max-md:h-10 max-md:before:absolute max-md:before:-inset-0.5",
  large: "max-md:h-11",
  none: "",
};
const PHONE_ICON_ONLY: Record<ButtonPhone, string> = { default: "max-md:w-10", large: "max-md:w-11", none: "" };

/** Class string for anything that should look like a button (links, menu triggers). */
export function buttonClasses({ variant = "secondary", size = "md", phone = "default", iconOnly = false, fullWidth = false }: ButtonStyleOptions = {}) {
  return cn(
    BASE,
    VARIANT[variant],
    SIZE[size],
    iconOnly && ICON_ONLY[size],
    PHONE[phone],
    iconOnly && PHONE_ICON_ONLY[phone],
    // Small and icon-only controls get a 44px hit area on touch screens.
    (size === "sm" || iconOnly) && "pointer-coarse:before:absolute pointer-coarse:before:-inset-2",
    fullWidth && "w-full",
  );
}

type ContentProps = {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
};

function ButtonContent({ icon, iconRight, size = "md", loading, children }: ContentProps) {
  const iconSize = size === "sm" ? 14 : 16;
  if (loading && !icon) {
    // Keep the width: the label stays in place, invisible, under a centered spinner.
    return (
      <>
        <span className="invisible inline-flex items-center gap-1.5">{children}</span>
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      </>
    );
  }
  return (
    <>
      {loading ? (
        <span className={cn("grid place-items-center", size === "sm" ? "size-3.5" : "size-4")}>
          <Spinner />
        </span>
      ) : (
        icon && <Icon icon={icon} size={iconSize} />
      )}
      {children}
      {iconRight && <Icon icon={iconRight} size={iconSize} />}
    </>
  );
}

export type ButtonProps = Omit<ComponentProps<"button">, "children"> &
  ButtonStyleOptions & {
    icon?: LucideIcon;
    iconRight?: LucideIcon;
    /** Shows a spinner in place of the leading icon and sets aria-busy; the button keeps its width. */
    loading?: boolean;
    /** Toggle buttons (Connect → Pending, Follow → Following): secondary look, check icon, aria-pressed. */
    pressed?: boolean;
    children?: ReactNode;
  };

export function Button({
  variant = "secondary",
  size = "md",
  phone = "default",
  iconOnly,
  fullWidth,
  icon,
  iconRight,
  loading,
  pressed,
  className,
  type = "button",
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const isToggle = pressed !== undefined;
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      aria-pressed={isToggle ? pressed : undefined}
      onClick={loading ? undefined : onClick}
      className={cn(buttonClasses({ variant: pressed ? "secondary" : variant, size, phone, iconOnly, fullWidth }), loading && "cursor-progress", className)}
      {...rest}
    >
      <ButtonContent icon={pressed ? Check : icon} iconRight={iconRight} size={size} loading={loading}>
        {children}
      </ButtonContent>
    </button>
  );
}

export type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "children"> &
  ButtonStyleOptions & {
    icon?: LucideIcon;
    iconRight?: LucideIcon;
    /** Renders a non-interactive, disabled-looking element instead of a link. */
    disabled?: boolean;
    children?: ReactNode;
  };

/** A link that looks like a button ("View job", "Show more moves"). External hrefs open in a new tab. */
export function ButtonLink({
  variant = "secondary",
  size = "md",
  phone = "default",
  iconOnly,
  fullWidth,
  icon,
  iconRight,
  disabled,
  className,
  children,
  href,
  ...rest
}: ButtonLinkProps) {
  const classes = cn(buttonClasses({ variant, size, phone, iconOnly, fullWidth }), className);
  if (disabled) {
    return (
      <span role="link" aria-disabled="true" className={classes}>
        <ButtonContent icon={icon} iconRight={iconRight} size={size}>
          {children}
        </ButtonContent>
      </span>
    );
  }
  const external = typeof href === "string" && /^https?:\/\//.test(href);
  return (
    <Link href={href} className={classes} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
      <ButtonContent icon={icon} iconRight={iconRight} size={size}>
        {children}
      </ButtonContent>
    </Link>
  );
}
