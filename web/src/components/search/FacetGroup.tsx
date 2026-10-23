import type { ReactNode } from "react";
import { Checkbox, ChoiceGroup } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import { FacetRows } from "./FacetRows";

export type FacetOption = { value: string; label: ReactNode; count: number; title?: string };

type FacetGroupProps = {
  /** URL parameter the checkboxes submit. */
  name: string;
  label: string;
  /** In natural order: fixed for Role group, by count for the others. */
  options: FacetOption[];
  selected: string[];
  /** The result total: a lone option that already covers every result can't narrow anything. */
  total: number;
  /** Rows shown before "Show more" (DESIGN.md §8.7: 6). */
  limit?: number;
  /**
   * Desktop rail: when nothing in the group matches, show only the selected values and fold the
   * disabled 0 rows under "Show N more" (the empty state already gives the way out). The sheet keeps
   * the full disabled list, where its footer explains it.
   */
  collapseEmpty?: boolean;
};

/**
 * Facet group (§8.7): 13/600 title, checkbox list (13px label, 12px --fg-3 count on the right),
 * "Show more" after six. Values with no matches are hidden unless selected. Rows keep their natural
 * order; a selected value is lifted only when it would otherwise sit behind "Show more" (FacetRows).
 * When nothing in the group matches (the filters left no results), the group stays, with its values
 * as disabled rows counting 0, so the reader sees what is there and what to remove (folded under
 * "Show more" in the rail: collapseEmpty). A group with one value that covers every result is hidden
 * (it can't narrow anything).
 */
export function FacetGroup({ name, label, options, selected, total, limit = 6, collapseEmpty }: FacetGroupProps) {
  const isSel = (o: FacetOption) => selected.includes(o.value);
  const anyMatch = options.some((o) => o.count > 0);
  const visible = anyMatch ? options.filter((o) => o.count > 0 || isSel(o)) : options;
  if (!visible.length) return null;
  if (!selected.length && visible.length === 1 && visible[0].count === total) return null;

  const row = (o: FacetOption) => {
    const checked = isSel(o);
    const disabled = o.count === 0 && !checked;
    return (
      <Checkbox
        // Remount when the URL changes the value, so a box unchecked elsewhere (a removed chip) follows.
        key={`${o.value}:${checked}`}
        name={name}
        value={o.value}
        defaultChecked={checked}
        disabled={disabled}
        // The count is formatted here ("1,245"), matching the heading; Checkbox's own count prints raw numbers.
        label={
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 flex-1" title={o.title}>
              {o.label}
            </span>
            <span className={cn("num text-caption", disabled ? "text-fg-disabled" : "text-fg-3")}>{o.count.toLocaleString("en-US")}</span>
          </span>
        }
      />
    );
  };

  return (
    <ChoiceGroup label={label}>
      <FacetRows limit={collapseEmpty && !anyMatch ? 0 : limit} items={visible.map((o) => ({ key: o.value, node: row(o), selected: isSel(o) }))} />
    </ChoiceGroup>
  );
}
