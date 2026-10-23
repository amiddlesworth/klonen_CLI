import Link from "next/link";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { ROLE_FACET_LABEL, searchHref, stateName, without, type SearchState } from "./params";

type AppliedFiltersProps = {
  state: SearchState;
  names: { workedAt: string | null; workedUnder: string | null };
  className?: string;
};

export type AppliedChip = { key: string; label: string; removeHref: string };

/** Every applied filter (and the query) as a removable chip, in facet order. */
export function appliedChips(state: SearchState, names: AppliedFiltersProps["names"]): AppliedChip[] {
  const chips: AppliedChip[] = [];
  if (state.q) chips.push({ key: "q", label: `‘${state.q}’`, removeHref: searchHref(state, { q: "" }) });
  if (state.type === "people") for (const v of state.role) chips.push({ key: `role:${v}`, label: ROLE_FACET_LABEL[v] ?? v, removeHref: searchHref(without(state, "role", v)) });
  for (const v of state.conference) chips.push({ key: `conf:${v}`, label: v, removeHref: searchHref(without(state, "conference", v)) });
  for (const v of state.state) chips.push({ key: `state:${v}`, label: stateName(v), removeHref: searchHref(without(state, "state", v)) });
  for (const v of state.division) chips.push({ key: `div:${v}`, label: v.replace(/^D-/, "Division "), removeHref: searchHref(without(state, "division", v)) });
  if (state.type === "people" && state.workedAt && names.workedAt)
    chips.push({ key: "workedAt", label: `Worked at ${names.workedAt}`, removeHref: searchHref(state, { workedAt: null }) });
  if (state.type === "people" && state.workedUnder && names.workedUnder)
    chips.push({ key: "workedUnder", label: `Worked under ${names.workedUnder}`, removeHref: searchHref(state, { workedUnder: null }) });
  return chips;
}

/**
 * An applied filter with its own remove control: the ui AppliedFilterChip's look (§8.1 FilterChip,
 * selected), with a label that truncates, so a long one ("Worked under Justin Leatherman") never pushes
 * its × under the row's fade mask. The full label stays in the remove control's name and the title.
 */
function RemovableChip({ label, removeHref }: { label: string; removeHref: string }) {
  return (
    <span
      title={label}
      className="inline-flex h-8 max-w-full min-w-0 items-center gap-1 rounded-sm border border-fg-1 bg-fg-1 pl-3 pr-1 text-small font-medium text-surface max-md:h-10"
    >
      <span className="min-w-0 truncate">{label}</span>
      <Link
        href={removeHref}
        scroll={false}
        aria-label={`Remove filter: ${label}`}
        className="relative grid size-6 shrink-0 place-items-center rounded-xs hover:bg-fg-2 before:absolute before:-inset-2.5"
      >
        <Icon icon={X} size={14} />
      </Link>
    </span>
  );
}

/**
 * Applied filters on tablet and phone (§8.7): removable FilterChips in one horizontally scrollable
 * row with a fade mask on the right edge. A chip is never wider than the row's unmasked width.
 */
export function AppliedFilters({ state, names, className }: AppliedFiltersProps) {
  const chips = appliedChips(state, names);
  if (!chips.length) return null;
  return (
    <ul
      aria-label="Applied filters"
      className={cn(
        "flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {chips.map((c) => (
        <li key={c.key} className="flex max-w-full shrink-0">
          <RemovableChip label={c.label} removeHref={c.removeHref} />
        </li>
      ))}
    </ul>
  );
}
