import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

const ITEM =
  "flex min-h-8 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-small text-fg-1 transition-colors " +
  "hover:bg-hover focus-visible:bg-hover focus-visible:-outline-offset-2 max-md:min-h-11 " +
  "aria-disabled:cursor-not-allowed aria-disabled:bg-transparent! aria-disabled:text-fg-disabled";

type ItemContentProps = { icon?: LucideIcon; description?: ReactNode; trailing?: ReactNode; destructive?: boolean; children: ReactNode };

function ItemContent({ icon, description, trailing, destructive, children }: ItemContentProps) {
  return (
    <>
      {icon && <Icon icon={icon} size={16} className={cn("self-start mt-px", destructive ? "text-danger" : "text-fg-2", !description && "self-center mt-0")} />}
      <span className="min-w-0 flex-1">
        <span className="block">{children}</span>
        {description && <span className="block text-caption text-fg-3">{description}</span>}
      </span>
      {trailing}
    </>
  );
}

export type MenuItemProps = Omit<ComponentProps<"button">, "children" | "role"> & {
  icon?: LucideIcon;
  description?: ReactNode;
  trailing?: ReactNode;
  /** Destructive items use --danger text. */
  destructive?: boolean;
  /** Keep the menu open after selecting (e.g. theme radios). */
  keepOpen?: boolean;
  children: ReactNode;
};

/** A menu action. Selecting it closes the menu unless keepOpen. */
export function MenuItem({ icon, description, trailing, destructive, keepOpen, disabled, className, children, ...rest }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      data-keep-open={keepOpen || undefined}
      className={cn(ITEM, destructive && "text-danger", className)}
      {...rest}
      onClick={disabled ? undefined : rest.onClick}
    >
      <ItemContent icon={icon} description={description} trailing={trailing} destructive={destructive}>
        {children}
      </ItemContent>
    </button>
  );
}

export type MenuLinkProps = Omit<ComponentProps<typeof Link>, "children" | "role"> & {
  icon?: LucideIcon;
  description?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
};

/** A menu item that navigates. */
export function MenuLink({ icon, description, trailing, className, children, ...rest }: MenuLinkProps) {
  return (
    <Link role="menuitem" tabIndex={-1} className={cn(ITEM, className)} {...rest}>
      <ItemContent icon={icon} description={description} trailing={trailing}>
        {children}
      </ItemContent>
    </Link>
  );
}

export type MenuRadioItemProps = Omit<ComponentProps<"button">, "children" | "role"> & {
  checked: boolean;
  description?: ReactNode;
  keepOpen?: boolean;
  children: ReactNode;
};

/** One option of a single-choice group (role="menuitemradio"), with a radio mark (Iris when checked). */
export function MenuRadioItem({ checked, description, keepOpen, disabled, className, children, ...rest }: MenuRadioItemProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      data-keep-open={keepOpen || undefined}
      className={cn(ITEM, description && "items-start", className)}
      {...rest}
      onClick={disabled ? undefined : rest.onClick}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 rounded-full border-[1.5px] transition-colors",
          description && "mt-px",
          checked ? "border-[5px] border-accent bg-on-accent" : "border-control bg-surface",
        )}
      />
      <ItemContent description={description}>{children}</ItemContent>
    </button>
  );
}

/** A labelled group of items ("Demo account", "Theme"). */
export function MenuGroup({ label, adornment, children, className }: { label: string; adornment?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={className}>
      <div aria-hidden="true" className="flex items-center gap-2 px-2 pb-1 pt-2 text-caption font-medium text-fg-3">
        {label}
        {adornment}
      </div>
      {children}
    </div>
  );
}

export function MenuDivider() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-divider" />;
}

/** Non-interactive content at the top of a menu. */
export function MenuHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="none" className={cn("px-2 py-2", className)}>
      {children}
    </div>
  );
}
