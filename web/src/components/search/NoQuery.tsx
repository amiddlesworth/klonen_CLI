import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterChip } from "@/components/ui/FilterChip";
import { PageSearchField } from "@/components/ui/PageSearchField";
import type { FacetCount, SearchTotals } from "@/lib/queries/searchx";
import { parseSearchParams, plural, searchHref } from "./params";
import type { PopularSearch } from "./popular";
import { PopularSearches } from "./PopularSearches";

const BASE = parseSearchParams({});
const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * The search start page (no query, no filters): a search box with real totals, a Filters button on
 * tablet and phone (the rail holds the facets on desktop), suggested searches, and every conference as
 * a one-tap browse.
 */
export function NoQuery({
  totals,
  popular,
  conferences,
  conferenceNames,
  filters,
}: {
  totals: SearchTotals;
  popular: PopularSearch[];
  conferences: FacetCount[];
  conferenceNames: Record<string, string>;
  /** The filter sheet trigger, shown below the desktop breakpoint. */
  filters?: ReactNode;
}) {
  return (
    <>
      <Card padding="main">
        <h1 className="text-display-sm">Search coaches and programs</h1>
        {/* Demo profiles are counted apart, so the sum matches the unfiltered "2,185 coaches". */}
        <p className="mt-0.5 text-small text-fg-2">
          <span className="num">{fmt(totals.sourced)}</span> coaches from the public staff pages of <span className="num">{fmt(totals.programsRead)}</span> of the{" "}
          <span className="num">{fmt(totals.programs)}</span> Division III football programs
          {totals.demo > 0 && (
            <>
              , plus <span className="num">{plural(totals.demo, "demo profile", "demo profiles")}</span>
            </>
          )}
          .
        </p>
        <form method="get" action="/search" role="search" aria-label="Search coaches and programs" className="mt-4">
          <PageSearchField name="q" placeholder="Name, program or conference" aria-label="Search coaches and programs" />
        </form>
        {filters && <div className="mt-3 lg:hidden">{filters}</div>}
      </Card>

      <PopularSearches items={popular} />

      {conferences.length > 0 && (
        <Card padding="main">
          <CardHeader title="Browse by conference" meta={`${conferences.length} conferences · number of coaches in each`} />
          <ul className="flex flex-wrap gap-2">
            {[...conferences]
              .sort((a, b) => a.value.localeCompare(b.value))
              .map((c) => (
                <li key={c.value}>
                  <FilterChip
                    selected={false}
                    href={searchHref({ ...BASE, conference: [c.value] })}
                    title={conferenceNames[c.value]}
                    aria-label={`${c.value}, ${plural(c.count, "coach", "coaches")}`}
                    scroll
                  >
                    {c.value}
                    <span className="num font-normal text-fg-3">{fmt(c.count)}</span>
                  </FilterChip>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </>
  );
}
