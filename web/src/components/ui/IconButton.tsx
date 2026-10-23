import Link from "next/link";
import type { ComponentProps } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClasses, type ButtonPhone, type ButtonSize } from "./Button";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

type Common = {
  icon: LucideIcon;
  /** Accessible name; also shown as the tooltip. Required: icon-only controls must be named. */
  label: string;
  variant?: "secondary" | "ghost";
  size?: ButtonSize;
  phone?: ButtonPhone;
  /** Show the label as a tooltip on hover and focus (default true). */
  tooltip?: boolean;
  className?: string;
  /** Layout classes for the tooltip wrapper (the flex/grid child when a tooltip is shown). */
  wrapperClassName?: string;
};

export type IconButtonProps = Common &
  Omit<ComponentProps<"button">, "children" | "aria-label"> & {
    loading?: boolean;
    /** Toggle (Save): aria-pressed; shows the check icon when pressed unless pressedIcon is given. */
    pressed?: boolean;
    pressedIcon?: LucideIcon;
  };

/** Square icon-only button (More, Save, Close, Connect in rows). */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  phone = "default",
  tooltip = true,
  loading,
  pressed,
  pressedIcon,
  className,
  wrapperClassName,
  type = "button",
  ...rest
}: IconButtonProps) {
  const iconSize = size === "sm" ? 14 : 16;
  const glyph = pressed ? (pressedIcon ?? Check) : icon;
  const button = (
    <button
      type={type}
      aria-label={label}
      aria-busy={loading || undefined}
      aria-pressed={pressed === undefined ? undefined : pressed}
      className={cn(buttonClasses({ variant, size, phone, iconOnly: true }), className)}
      {...rest}
    >
      {loading ? <Spinner /> : <Icon icon={glyph} size={iconSize} />}
    </button>
  );
  return tooltip ? (
    <Tooltip content={label} className={wrapperClassName}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

export type IconLinkProps = Common & Omit<ComponentProps<typeof Link>, "children" | "aria-label">;

/** Icon-only link (phone Messaging button). */
export function IconLink({ icon, label, variant = "ghost", size = "md", phone = "default", tooltip = true, className, wrapperClassName, ...rest }: IconLinkProps) {
  const link = (
    <Link aria-label={label} className={cn(buttonClasses({ variant, size, phone, iconOnly: true }), className)} {...rest}>
      <Icon icon={icon} size={size === "sm" ? 14 : 16} />
    </Link>
  );
  return tooltip ? (
    <Tooltip content={label} className={wrapperClassName}>
      {link}
    </Tooltip>
  ) : (
    link
  );
}
