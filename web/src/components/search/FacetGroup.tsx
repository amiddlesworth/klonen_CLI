import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox, ChoiceGroup } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";

export type FacetOption = { value: string; label: ReactNode; count: number; title?: string };

type FacetGroupProps = {
  /** URL parameter the checkboxes submit. */
  name: string;
  label: string;
  options: FacetOption[];
  selected: string[];
  /** Rows shown before "Show more" (DESIGN.md §8.7: 6). */
  limit?: number;
};

/**
 * Facet group (§8.7): 13/600 title, checkbox list (13px label, 12px --fg-3 count on the right),
 * "Show more" after six. Values with no matches are hidden unless selected; selected values lead.
 * The remaining rows sit in a <details> (open when one of them is selected), so it works without
 * JavaScript.
 */
export function FacetGroup({ name, label, options, selected, limit = 6 }: FacetGroupProps) {
  // Selected values first, so a choice never hides behind "Show more".
  const visible = options
    .filter((o) => o.count > 0 || selected.includes(o.value))
    .sort((a, b) => Number(selected.includes(b.value)) - Number(selected.includes(a.value)));
  if (!visible.length) return null;
  const head = visible.slice(0, limit);
  const rest = visible.slice(limit);
  const restSelected = rest.some((o) => selected.includes(o.value));

  const row = (o: FacetOption) => {
    const checked = selected.includes(o.value);
    return (
      <Checkbox
        // Remount when the URL changes the value, so a box unchecked elsewhere (a removed chip) follows.
        key={`${o.value}:${checked}`}
        name={name}
        value={o.value}
        defaultChecked={checked}
        label={o.title ? <span title={o.title}>{o.label}</span> : o.label}
        count={o.count}
      />
    );
  };

  return (
    <ChoiceGroup label={label}>
      <div className="flex flex-col">{head.map(row)}</div>
      {rest.length > 0 && (
        <details open={restSelected} className="group/more">
          <summary className="relative inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-xs text-small font-medium text-fg-2 transition-colors hover:text-fg-1 group-open/more:hidden max-md:h-11 [&::-webkit-details-marker]:hidden">
            Show {rest.length} more
            <Icon icon={ChevronDown} size={14} />
          </summary>
          <div className="flex flex-col">{rest.map(row)}</div>
        </details>
      )}
    </ChoiceGroup>
  );
}
