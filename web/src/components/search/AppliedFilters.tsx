import { AppliedFilterChip } from "@/components/ui/FilterChip";
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
 * Applied filters on tablet and phone (§8.7): removable FilterChips in one horizontally scrollable
 * row with a fade mask on the right edge.
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
        <li key={c.key} className="shrink-0">
          <AppliedFilterChip label={c.label} removeHref={c.removeHref} />
        </li>
      ))}
    </ul>
  );
}
