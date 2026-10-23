import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { cn } from "@/lib/cn";
import type { FacetCounts } from "@/lib/queries/searchx";
import { EntityPicker, type PickedEntity } from "./EntityPicker";
import { FacetForm } from "./FacetForm";
import { FacetGroup } from "./FacetGroup";
import { ROLE_FACET, ROLE_FACET_LABEL, appliedCount, cleared, searchHref, stateName, type SearchState } from "./params";

export type FacetPanelProps = {
  state: SearchState;
  counts: FacetCounts;
  /** Result total (a lone value covering every result is hidden). */
  total: number;
  /** Every value of each facet, for groups the current filters leave empty (shown as disabled 0 rows). */
  allValues?: FacetCounts | null;
  conferenceNames: Record<string, string>;
  workedAt: PickedEntity | null;
  workedUnder: PickedEntity | null;
  unmatched: { workedAt: string | null; workedUnder: string | null };
  /** "rail": desktop facets with their own heading; "sheet": inside the phone/tablet filter sheet. */
  variant: "rail" | "sheet";
  /** id of the <form>, so the sheet's "Show results" button can submit it. */
  formId: string;
  /** Show the Keywords field (off on the start page, which has its own search box). */
  keywords?: boolean;
};

/**
 * Search facets (§8.7): Keywords, Role group, Conference, State, Division, Worked at, Worked under.
 * Programs search shows only Keywords, Conference, State and Division.
 */
export function FacetPanel({ state, counts, total, allValues, conferenceNames, workedAt, workedUnder, unmatched, variant, formId, keywords = true }: FacetPanelProps) {
  const values = (key: "conference" | "state" | "division", selected: string[]) => withSelected(withAll(counts[key], allValues?.[key]), selected);
  const people = state.type === "people";
  const applied = appliedCount(state);
  const idPrefix = `${variant}-facet`;
  const collapseEmpty = variant === "rail";

  return (
    <FacetForm id={formId} label={people ? "Filter coaches" : "Filter programs"} className="gap-5">
      {variant === "rail" && (
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-title">Filters</h2>
          {applied > 0 && (
            <TextLink href={searchHref(cleared(state))} scroll={false} target24 className="text-small">
              Clear all
            </TextLink>
          )}
        </div>
      )}
      {!people && <input type="hidden" name="type" value="programs" />}

      {keywords && (
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-q`} className="mb-1 block text-small font-semibold text-fg-1">
            Keywords
          </label>
          <div className="relative">
            <Icon icon={Search} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input
              key={state.q}
              id={`${idPrefix}-q`}
              name="q"
              type="search"
              defaultValue={state.q}
              placeholder={people ? "Name, title or program" : "Name or conference"}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className={cn(CONTROL_CLASSES, "h-9 pl-9 max-md:h-11")}
            />
          </div>
        </div>
      )}

      {people && (
        <FacetGroup
          name="role"
          label="Role group"
          selected={state.role}
          total={total}
          collapseEmpty={collapseEmpty}
          options={ROLE_FACET.map((r) => ({ value: r, label: ROLE_FACET_LABEL[r], count: counts.role.find((c) => c.value === r)?.count ?? 0 }))}
        />
      )}
      <FacetGroup
        name="conference"
        label="Conference"
        selected={state.conference}
        total={total}
        collapseEmpty={collapseEmpty}
        options={values("conference", state.conference).map((c) => ({ value: c.value, label: c.value, title: conferenceNames[c.value], count: c.count }))}
      />
      <FacetGroup
        name="state"
        label="State"
        selected={state.state}
        total={total}
        collapseEmpty={collapseEmpty}
        options={values("state", state.state).map((c) => ({ value: c.value, label: stateName(c.value), count: c.count }))}
      />
      <FacetGroup
        name="division"
        label="Division"
        selected={state.division}
        total={total}
        collapseEmpty={collapseEmpty}
        options={values("division", state.division).map((c) => ({ value: c.value, label: c.value.replace(/^D-/, "Division "), count: c.count }))}
      />
      {people && (
        <>
          <EntityPicker key={`at:${workedAt?.slug ?? ""}`} kind="program" param="workedAt" label="Worked at" state={state} selected={workedAt} unmatched={unmatched.workedAt} idPrefix={idPrefix} />
          <EntityPicker key={`under:${workedUnder?.slug ?? ""}`} kind="person" param="workedUnder" label="Worked under" state={state} selected={workedUnder} unmatched={unmatched.workedUnder} idPrefix={idPrefix} />
        </>
      )}
      {variant === "rail" && (
        <noscript>
          <Button type="submit" fullWidth>
            Apply filters
          </Button>
        </noscript>
      )}
    </FacetForm>
  );
}

/** When the filters leave a group empty, its full list of values with zero counts (disabled rows). */
function withAll(counts: { value: string; count: number }[], all: { value: string; count: number }[] | undefined) {
  if (counts.some((c) => c.count > 0) || !all?.length) return counts;
  return all.map((a) => ({ value: a.value, count: 0 }));
}

/** Keeps selected values that have no matches under the other filters, with a zero count. */
function withSelected(counts: { value: string; count: number }[], selected: string[]) {
  const out = [...counts];
  for (const v of selected) if (!out.some((c) => c.value === v)) out.push({ value: v, count: 0 });
  return out;
}
