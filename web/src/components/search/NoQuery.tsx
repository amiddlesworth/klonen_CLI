import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterChip } from "@/components/ui/FilterChip";
import { SearchField } from "@/components/ui/SearchField";
import type { FacetCount } from "@/lib/queries/searchx";
import { parseSearchParams, searchHref } from "./params";
import type { PopularSearch } from "./popular";
import { PopularSearches } from "./PopularSearches";

const BASE = parseSearchParams({});

/**
 * The search start page (no query, no filters): a search box with real totals, popular searches,
 * and every conference as a one-tap browse.
 */
export function NoQuery({
  totals,
  popular,
  conferences,
  conferenceNames,
}: {
  totals: { people: number; programs: number };
  popular: PopularSearch[];
  conferences: FacetCount[];
  conferenceNames: Record<string, string>;
}) {
  return (
    <>
      <Card padding="main">
        <h1 className="text-title">Search coaches and programs</h1>
        <p className="mt-0.5 text-small text-fg-2">
          <span className="num">{totals.people.toLocaleString("en-US")}</span> coaches and <span className="num">{totals.programs}</span> programs in Division III
          football, built from public staff pages.
        </p>
        <form method="get" action="/search" role="search" aria-label="Search coaches and programs" className="mt-4 flex gap-2">
          <SearchField variant="block" name="q" placeholder="Name, program or conference" aria-label="Search coaches and programs" wrapperClassName="min-w-0 flex-1" enterKeyHint="search" />
          <Button type="submit" variant="primary" phone="large">
            Search
          </Button>
        </form>
      </Card>

      <PopularSearches items={popular} />

      {conferences.length > 0 && (
        <Card padding="main">
          <CardHeader title="Browse by conference" meta={`${conferences.length} conferences`} />
          <ul className="flex flex-wrap gap-2">
            {[...conferences]
              .sort((a, b) => a.value.localeCompare(b.value))
              .map((c) => (
                <li key={c.value}>
                  <FilterChip selected={false} href={searchHref({ ...BASE, conference: [c.value] })} title={conferenceNames[c.value]} scroll>
                    {c.value}
                    <span className="num font-normal text-fg-3">{c.count}</span>
                  </FilterChip>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </>
  );
}
