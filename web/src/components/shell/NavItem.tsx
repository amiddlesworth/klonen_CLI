import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CountBadge, withCount } from "@/components/ui/CountBadge";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Top nav item (§8.2): icon 20 over a 12/500 label, min width 64 (56 at tablet). Inactive --fg-2,
 * hover --fg-1, active --fg-1 plus a 2px ink bar flush with the bottom border.
 */
export const NAV_ITEM =
  "relative flex h-full min-w-16 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-none px-2 text-caption font-medium text-fg-2 transition-colors " +
  "hover:text-fg-1 focus-visible:-outline-offset-2 md:max-lg:min-w-14 md:max-lg:px-1.5 " +
  "aria-[current=page]:text-fg-1 aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-t-[2px] aria-[current=page]:after:bg-fg-1";

/**
 * Phone tab-bar cell (§8.2 BottomTabBar): icon 22 over a 12/500 label, 3px gap; inactive --fg-2,
 * active (aria-current="page") --fg-1 and 600. Shared by links, the Me menu and the Sign in menu.
 */
export const TAB_CELL =
  "relative flex min-w-0 flex-col items-center justify-center gap-[3px] whitespace-nowrap text-caption font-medium tracking-[-0.01em] text-fg-2 focus-visible:-outline-offset-2 " +
  "aria-[current=page]:font-semibold aria-[current=page]:text-fg-1";

/** The icon slot of a nav item, with an optional count badge at the icon's top-right. */
export function NavIcon({ icon, count = 0, children }: { icon?: LucideIcon; count?: number; children?: ReactNode }) {
  return (
    <span className="relative grid">
      {icon ? <Icon icon={icon} size={20} /> : children}
      <CountBadge count={count} className="-top-1.5 left-3" />
    </span>
  );
}

type NavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  count?: number;
  /** Noun for the count in the accessible name ("new", "unread"). */
  countNoun?: string;
};

export function NavItem({ href, label, icon, active, count = 0, countNoun = "new" }: NavItemProps) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} aria-label={count > 0 ? withCount(label, count, countNoun) : undefined} className={cn(NAV_ITEM)}>
      <NavIcon icon={icon} count={count} />
      <span>{label}</span>
    </Link>
  );
}
