"use client";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Kbd";
import { OrgMark } from "@/components/ui/OrgMark";
import { SkeletonAvatar, SkeletonText } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type { TypeaheadOption, TypeaheadResponse } from "./typeahead";

type TypeaheadPanelProps = {
  term: string;
  /** null while the first results load (3 skeleton rows). */
  results: TypeaheadResponse | null;
  options: TypeaheadOption[];
  active: number;
  listId: string;
  onActivate?: (index: number) => void;
  onPick?: (option: TypeaheadOption) => void;
  className?: string;
};

/**
 * Typeahead panel (§8.1): level 2, radius 8, 4px padding. Groups People (avatar 24, name,
 * title · program) and Programs (tile 24, name, division · conference), 44px rows, active row
 * --accent-subtle with a ↵ hint, "See all results for '{q}'" last.
 */
export function TypeaheadPanel({ term, results, options, active, listId, onActivate, onPick, className }: TypeaheadPanelProps) {
  const rowCls = (i: number) =>
    cn("flex h-11 min-w-0 items-center gap-2.5 rounded-sm px-2 text-left transition-colors", active === i ? "bg-accent-subtle" : "hover:bg-hover");

  const renderOption = (o: TypeaheadOption) => {
    const i = options.indexOf(o);
    const common = {
      id: `${listId}-o${i}`,
      role: "option" as const,
      "aria-selected": active === i,
      tabIndex: -1,
      onMouseEnter: () => onActivate?.(i),
      onClick: () => onPick?.(o),
      className: rowCls(i),
    };
    if (o.kind === "all") {
      return (
        <Link key={o.key} href={o.href} {...common}>
          <span className="grid size-6 shrink-0 place-items-center text-fg-2">
            <Icon icon={Search} size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-small text-fg-1">
            See all results for ‘<span className="font-medium">{term}</span>’
          </span>
          {active === i && <Kbd>↵</Kbd>}
        </Link>
      );
    }
    return (
      <Link key={o.key} href={o.href} {...common}>
        {o.kind === "person" ? <Avatar name={o.name} tintKey={o.slug} size={24} /> : <OrgMark shortName={o.shortName} name={o.name} size={24} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-medium leading-[18px] text-fg-1">{o.name}</span>
          {o.meta && <span className="block truncate text-caption text-fg-3">{o.meta}</span>}
        </span>
        {active === i && <Kbd>↵</Kbd>}
      </Link>
    );
  };

  const people = options.filter((o) => o.kind === "person");
  const programs = options.filter((o) => o.kind === "program");
  const all = options.find((o) => o.kind === "all");

  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className={cn("max-h-[min(70dvh,560px)] overflow-y-auto rounded-md bg-surface p-1 text-fg-1 shadow-pop", className)}
    >
      {results === null ? (
        <div aria-busy="true" className="py-1">
          <span className="sr-only" role="status">
            Loading suggestions
          </span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-11 items-center gap-2.5 px-2">
              <SkeletonAvatar size={24} />
              <SkeletonText className="flex-1" lines={2} lineHeight={16} widths={[i === 1 ? "48%" : "60%", i === 1 ? "66%" : "40%"]} />
            </div>
          ))}
        </div>
      ) : (
        <div id={listId} role="listbox" aria-label="Search suggestions">
          {people.length > 0 && (
            <div role="group" aria-label="People">
              <div aria-hidden="true" className="px-2 pb-1 pt-2 text-caption font-medium text-fg-3">
                People
              </div>
              {people.map(renderOption)}
            </div>
          )}
          {programs.length > 0 && (
            <div role="group" aria-label="Programs">
              <div aria-hidden="true" className="px-2 pb-1 pt-2 text-caption font-medium text-fg-3">
                Programs
              </div>
              {programs.map(renderOption)}
            </div>
          )}
          {people.length === 0 && programs.length === 0 && (
            <div role="presentation" className="px-2 py-3">
              <p className="text-small font-medium text-fg-1">No coaches or programs match ‘{term}’.</p>
              <p className="text-caption text-fg-2">Try a last name, a school or a conference abbreviation.</p>
            </div>
          )}
          {all && (
            <div role="presentation" className="mt-1 border-t border-divider pt-1">
              {renderOption(all)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
