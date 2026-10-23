import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

/** Row look shared by link and disclosure rows in the Shortcuts card (§8.5: 36px, icon 16, label 13 --fg-2, count 12 --fg-3). */
export const SHORTCUT_ROW = "flex h-9 items-center gap-2.5 rounded-sm px-2 text-small text-fg-2 transition-colors hover:bg-hover hover:text-fg-1";

export function ShortcutCount({ n }: { n: number }) {
  return <span className="num text-caption text-fg-3">{n}</span>;
}

/** A shortcut that navigates. */
export function ShortcutLink({ href, icon, label, count }: { href: string; icon: LucideIcon; label: string; count?: number }) {
  return (
    <Link href={href} className={SHORTCUT_ROW}>
      <Icon icon={icon} size={16} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <ShortcutCount n={count} />}
    </Link>
  );
}

/**
 * A shortcut whose items open in place (Programs I follow, Saved jobs): a <details> row with the
 * count and a chevron that turns 90° when open (§5.5), then the items as 32px links.
 */
export function ShortcutDisclosure({ icon, label, count, children }: { icon: LucideIcon; label: string; count: number; children: ReactNode }) {
  return (
    <details className="group">
      <summary className={`${SHORTCUT_ROW} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <Icon icon={icon} size={16} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ShortcutCount n={count} />
        <Icon icon={ChevronRight} size={12} className="text-fg-3 transition-transform duration-[120ms] group-open:rotate-90 motion-reduce:transition-none" />
      </summary>
      <ul className="pb-1 pl-[34px]">{children}</ul>
    </details>
  );
}

/** One item inside a ShortcutDisclosure. */
export function ShortcutItem({ href, children, meta }: { href: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="block min-h-8 rounded-sm px-2 py-1.5 text-small leading-5 text-fg-2 transition-colors hover:bg-hover hover:text-fg-1">
        <span className="block truncate">{children}</span>
        {meta && <span className="block truncate text-caption text-fg-3">{meta}</span>}
      </Link>
    </li>
  );
}
