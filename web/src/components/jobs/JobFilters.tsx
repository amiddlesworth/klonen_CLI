"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { Popover } from "@/components/ui/Popover";
import { SearchField } from "@/components/ui/SearchField";
import { cn } from "@/lib/cn";
import type { FacetOption, JobFacets } from "@/lib/queries/jobsx";
import { hasFilters, jobsHref, type JobsQuery } from "./labels";

// FilterChip look (§8.1): 32px desktop / 40px phone (44px hit area), radius 6, secondary;
// selected = --fg-1 fill with --surface text and a check icon.
const CHIP =
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 text-small font-medium transition-colors max-md:h-10 max-md:before:absolute max-md:before:-inset-0.5";
const CHIP_OFF = "border-control bg-surface text-fg-1 shadow-btn hover:bg-hover active:bg-pressed";
const CHIP_ON = "border-fg-1 bg-fg-1 text-surface";

type Group = "roles" | "states" | "conferences";

type FilterMenuProps = {
  group: Group;
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (group: Group, values: string[]) => void;
  pending: boolean;
};

function FilterMenu({ group, label, options, selected, onChange, pending }: FilterMenuProps) {
  const on = selected.length > 0;
  const summary = selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? selected[0]) : `${label} · ${selected.length}`;
  const toggle = (v: string, checked: boolean) => onChange(group, checked ? [...selected, v] : selected.filter((s) => s !== v));
  return (
    <Popover
      label={`Filter by ${label.toLowerCase()}`}
      triggerLabel={on ? `${label}: ${selected.map((s) => options.find((o) => o.value === s)?.label ?? s).join(", ")}` : `${label} filter`}
      triggerClassName={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
      trigger={
        <>
          {on && <Icon icon={Check} size={14} />}
          <span className="max-w-40 truncate">{on ? summary : label}</span>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
      width={264}
      panelClassName="p-2"
    >
      <fieldset aria-busy={pending || undefined} className="min-w-0">
        <legend className="px-1 pb-1 pt-0.5 text-small font-semibold text-fg-1">{label}</legend>
        <div className="max-h-[min(320px,calc(100dvh-160px))] overflow-y-auto overscroll-contain px-1">
          {options.length ? (
            options.map((o) => (
              <Checkbox
                key={o.value}
                name={group}
                value={o.value}
                label={o.label}
                count={o.count}
                checked={selected.includes(o.value)}
                disabled={!selected.includes(o.value) && o.count === 0}
                onChange={(e) => toggle(o.value, e.currentTarget.checked)}
              />
            ))
          ) : (
            <p className="py-2 text-small text-fg-3">No options for these filters.</p>
          )}
        </div>
        {on && (
          <div className="mt-1 border-t border-divider px-1 pt-1">
            <button type="button" onClick={() => onChange(group, [])} className={cn(buttonClasses({ variant: "ghost", size: "sm" }), "-ml-2.5")}>
              Clear {label.toLowerCase()}
            </button>
          </div>
        )}
      </fieldset>
    </Popover>
  );
}

/**
 * Jobs filters (§8.9): a keyword box and FilterChips (Role group ▾, State ▾, Conference ▾) that
 * open checkbox menus. Everything lives in the URL; the keyword box is a plain GET form, so it
 * works before JavaScript loads.
 */
export function JobFilters({ query, facets, showClear = true }: { query: JobsQuery; facets: JobFacets; /** False when the results' empty state offers Clear filters instead. */ showClear?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Checkboxes update at once; the list follows when the server render arrives.
  const [shown, setShown] = useOptimistic(query);
  const onChange = (group: Group, values: string[]) => {
    const next = { ...shown, [group]: values, page: 1, id: null };
    startTransition(() => {
      setShown(next);
      router.replace(jobsHref(next), { scroll: false });
    });
  };
  const any = hasFilters(query);
  return (
    <div className="flex flex-col gap-3">
      <form action="/jobs" method="get" role="search" aria-label="Search jobs" className="flex gap-2">
        <SearchField
          variant="block"
          name="q"
          defaultValue={query.q}
          key={query.q}
          placeholder="Title, program or conference"
          aria-label="Search jobs by title, program or conference"
          wrapperClassName="flex-1"
        />
        {query.roles.length > 0 && <input type="hidden" name="role" value={query.roles.join(",")} />}
        {query.states.length > 0 && <input type="hidden" name="state" value={query.states.join(",")} />}
        {query.conferences.length > 0 && <input type="hidden" name="conf" value={query.conferences.join(",")} />}
        <button type="submit" className={cn(buttonClasses({ variant: "secondary", phone: "large" }), "md:h-9")}>
          Search
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-2" aria-busy={pending || undefined}>
        <FilterMenu group="roles" label="Role group" options={facets.roles} selected={shown.roles} onChange={onChange} pending={pending} />
        <FilterMenu group="states" label="State" options={facets.states} selected={shown.states} onChange={onChange} pending={pending} />
        <FilterMenu group="conferences" label="Conference" options={facets.conferences} selected={shown.conferences} onChange={onChange} pending={pending} />
        {any && showClear && (
          <Link href="/jobs" scroll={false} className={buttonClasses({ variant: "ghost" })}>
            Clear filters
          </Link>
        )}
      </div>
    </div>
  );
}
