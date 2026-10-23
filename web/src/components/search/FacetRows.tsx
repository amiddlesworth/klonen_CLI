"use client";
import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

export type FacetRowItem = { key: string; node: ReactNode; selected: boolean };

/**
 * A facet group's rows in their natural order (fixed for Role group, by count elsewhere), the first
 * `limit` shown and the rest behind "Show N more". Rows never move under the pointer: a selected value
 * is lifted above "Show more" only while the list is collapsed and the value would otherwise be hidden
 * behind it. Once the reader expands the list it stays in natural order (and stays expanded across
 * the facet updates it triggers), so checking a value inside it leaves every row where it was.
 * A native <details>, so the list still expands without JavaScript.
 */
export function FacetRows({ items, limit }: { items: FacetRowItem[]; limit: number }) {
  const [expanded, setExpanded] = useState(false);
  const natural = items.slice(0, limit);
  const tail = items.slice(limit);
  const lifted = expanded ? [] : tail.filter((i) => i.selected);
  const head = [...natural, ...lifted];
  const rest = expanded ? tail : tail.filter((i) => !i.selected);

  return (
    <>
      {head.length > 0 && <div className="flex flex-col">{head.map((i) => <Fragment key={i.key}>{i.node}</Fragment>)}</div>}
      {rest.length > 0 && (
        <details open={expanded} onToggle={(e) => setExpanded(e.currentTarget.open)} className="group/more">
          <summary className="relative inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-xs text-small font-medium text-fg-2 transition-colors hover:text-fg-1 group-open/more:hidden max-md:h-11 [&::-webkit-details-marker]:hidden">
            Show {rest.length} more
            <Icon icon={ChevronDown} size={14} />
          </summary>
          <div className="flex flex-col">{rest.map((i) => <Fragment key={i.key}>{i.node}</Fragment>)}</div>
        </details>
      )}
    </>
  );
}
