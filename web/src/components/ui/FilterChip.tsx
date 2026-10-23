import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

const BASE =
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 text-small font-medium transition-colors max-md:h-10 max-md:before:absolute max-md:before:-inset-0.5";
const OFF = "border-control bg-surface text-fg-1 shadow-btn hover:bg-hover active:bg-pressed";
const ON = "border-fg-1 bg-fg-1 text-surface";

type FilterChipProps = {
  selected: boolean;
  children: ReactNode;
  className?: string;
} & ({ href: string } & Omit<ComponentProps<typeof Link>, "href" | "children"> | ({ href?: undefined } & Omit<ComponentProps<"button">, "children">));

/**
 * FilterChip (§8.1): 32px desktop / 40px phone, radius 6, secondary look; selected = --fg-1 fill
 * with --surface text and a check icon, aria-pressed. Renders a link when href is given.
 */
export function FilterChip({ selected, children, className, ...rest }: FilterChipProps) {
  const cls = cn(BASE, selected ? ON : OFF, className);
  const content = (
    <>
      {selected && <Icon icon={Check} size={14} />}
      {children}
    </>
  );
  if (rest.href !== undefined) {
    const { href, ...linkRest } = rest as { href: string } & Omit<ComponentProps<typeof Link>, "href" | "children">;
    return (
      <Link href={href} aria-current={selected ? "true" : undefined} className={cls} scroll={false} {...linkRest}>
        {content}
      </Link>
    );
  }
  const buttonRest = rest as Omit<ComponentProps<"button">, "children">;
  return (
    <button type="button" aria-pressed={selected} className={cls} {...buttonRest}>
      {content}
    </button>
  );
}

/** An applied filter with its own remove control ("Remove filter: NWC"). */
export function AppliedFilterChip({ label, removeHref, className }: { label: string; removeHref: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-8 shrink-0 items-center gap-1 rounded-sm border border-fg-1 bg-fg-1 pl-3 pr-1 text-small font-medium text-surface max-md:h-10", className)}>
      {label}
      <Link
        href={removeHref}
        scroll={false}
        aria-label={`Remove filter: ${label}`}
        className="relative grid size-6 place-items-center rounded-xs hover:bg-fg-2 before:absolute before:-inset-2.5"
      >
        <Icon icon={X} size={14} />
      </Link>
    </span>
  );
}
