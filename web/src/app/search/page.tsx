import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Info, SearchX } from "lucide-react";
import { InferredFootnote } from "@/components/data/InferredYear";
import { AppliedFilters } from "@/components/search/AppliedFilters";
import { FacetPanel } from "@/components/search/FacetPanel";
import { FilterSheet } from "@/components/search/FilterSheet";
import type { PickedEntity } from "@/components/search/EntityPicker";
import { NoQuery } from "@/components/search/NoQuery";
import {
  VALUE_FACET_LABEL,
  appliedCount,
  canonicalFacets,
  capitalize,
  cleared,
  describeFilters,
  hasCriteria,
  parseSearchParams,
  peopleOnly,
  plural,
  possessive,
  searchHref,
  without,
  type KnownFacetValues,
  type RawParams,
  type SearchState,
  type ValueFacet,
} from "@/components/search/params";
import { PendingRegion } from "@/components/search/PendingRegion";
import { getPopularSearches } from "@/components/search/popular";
import { PopularSearches } from "@/components/search/PopularSearches";
import { PersonResultRow, ProgramResultRow } from "@/components/search/ResultRows";
import { SearchSkeleton, StartSkeleton } from "@/components/search/SearchSkeleton";
import { contextInferred } from "@/components/search/TreeContextLine";
import { SidebarLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageSearchField } from "@/components/ui/PageSearchField";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { TextLink } from "@/components/ui/TextLink";
import { BRAND } from "@/lib/brand";
import { levelShort } from "@/lib/format";
import {
  SEARCH_PAGE_SIZE,
  conferenceNames,
  countPeople,
  countPrograms,
  divisionValues,
  findOrgByText,
  findPersonByText,
  getOrgRef,
  getPersonRef,
  peopleFacetCounts,
  programFacetCounts,
  searchPeopleX,
  searchProgramsX,
  searchTotals,
  treeContexts,
  type OrgRef,
  type PersonRef,
} from "@/lib/queries/searchx";
import { getSession } from "@/lib/session";

type PageProps = { searchParams: Promise<RawParams> };

type Unmatched = { workedAt: string | null; workedUnder: string | null };
type UnknownFacets = Record<ValueFacet, string[]>;

const fmt = (n: number) => n.toLocaleString("en-US");

async function knownFacetValues(): Promise<KnownFacetValues> {
  const [division, conference] = await Promise.all([divisionValues(), conferenceNames()]);
  return { division, conference };
}

/** The URL state with the values the page dropped put back (so removing one note keeps the others). */
function withDropped(s: SearchState, unknown: UnknownFacets, unmatched: Unmatched): SearchState {
  return {
    ...s,
    division: [...s.division, ...unknown.division],
    conference: [...s.conference, ...unknown.conference],
    state: [...s.state, ...unknown.state],
    workedAt: unmatched.workedAt ?? s.workedAt,
    workedUnder: unmatched.workedUnder ?? s.workedUnder,
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const known = await knownFacetValues().catch(() => null);
  const parsed = parseSearchParams(await searchParams);
  const s = known ? canonicalFacets(parsed, known).state : parsed;
  if (!hasCriteria(s)) {
    return {
      title: "Search",
      description: `Search Division III football coaches and programs on ${BRAND.name}: filter by conference, state, role and coaching tree.`,
    };
  }
  const [at, under] = await Promise.all([
    s.type === "people" && s.workedAt ? getOrgRef(s.workedAt).catch(() => null) : null,
    s.type === "people" && s.workedUnder ? getPersonRef(s.workedUnder).catch(() => null) : null,
  ]);
  const phrase = describeFilters(s, { workedAt: at?.shortName, workedUnder: under?.fullName });
  const title = s.q ? `Search results for ‘${s.q}’` : capitalize(phrase === "programs" ? "Division III football programs" : phrase);
  return {
    title,
    description: s.q ? `${capitalize(phrase)} matching ‘${s.q}’ on ${BRAND.name}.` : `${capitalize(phrase)} on ${BRAND.name}, built from public staff pages.`,
    robots: { index: false, follow: true },
  };
}

function pickedOrg(o: OrgRef): PickedEntity {
  // The full name goes to the tile, so its initials match the program everywhere else ("PU").
  return { slug: o.slug, name: o.shortName, shortName: o.shortName, orgName: o.name, meta: [levelShort(o.level), o.conference].filter(Boolean).join(" · ") || null };
}

function pickedPerson(p: PersonRef): PickedEntity {
  // Program first: the rail clamps the meta to two lines, and a long title must not push the program out.
  return { slug: p.slug, name: p.fullName, meta: [p.orgShortName, p.currentTitle].filter(Boolean).join(" · ") || null };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const parsed = parseSearchParams(await searchParams);
  const isPeople = parsed.type === "people";

  // Division, conference and state values are checked against the data: aliases ("d3", "nwc",
  // "Oregon") redirect to the canonical URL; anything else is dropped and reported above the results.
  const known = await knownFacetValues();
  const canon = canonicalFacets(parsed, known);
  const raw = canon.state;
  const unknown: UnknownFacets = canon.unknown;

  // "Worked at" / "Worked under" take slugs. Ids and free text (the no-JS form) resolve to the best
  // match and redirect to the canonical URL; text that matches nothing is reported above the results.
  const [at, under] = await Promise.all([
    isPeople && raw.workedAt ? getOrgRef(raw.workedAt) : null,
    isPeople && raw.workedUnder ? getPersonRef(raw.workedUnder) : null,
  ]);
  let atSlug = raw.workedAt;
  let underSlug = raw.workedUnder;
  if (isPeople && (raw.workedAt || raw.workedUnder)) {
    const [foundAt, foundUnder] = await Promise.all([raw.workedAt && !at ? findOrgByText(raw.workedAt) : null, raw.workedUnder && !under ? findPersonByText(raw.workedUnder) : null]);
    atSlug = (at ?? foundAt)?.slug ?? raw.workedAt;
    underSlug = (under ?? foundUnder)?.slug ?? raw.workedUnder;
  }
  if (canon.aliased || atSlug !== raw.workedAt || underSlug !== raw.workedUnder) {
    redirect(searchHref(withDropped({ ...raw, workedAt: atSlug, workedUnder: underSlug }, unknown, { workedAt: null, workedUnder: null }), { page: raw.page }));
  }
  const unmatched: Unmatched = {
    workedAt: isPeople && raw.workedAt && !at ? raw.workedAt : null,
    workedUnder: isPeople && raw.workedUnder && !under ? raw.workedUnder : null,
  };
  // The Programs tab never carries people-only filters.
  const s: SearchState = isPeople ? { ...raw, workedAt: at?.slug ?? null, workedUnder: under?.slug ?? null } : { ...raw, role: [], workedAt: null, workedUnder: null };
  const anyDropped = !!unmatched.workedAt || !!unmatched.workedUnder || Object.values(unknown).some((v) => v.length > 0);
  const start = !hasCriteria(s) && !anyDropped;

  // The skeleton matches what will load: the start page, or a results list.
  return (
    <Suspense fallback={start ? <StartSkeleton /> : <SearchSkeleton />}>
      {start ? <StartPage s={s} /> : <Results s={s} at={at} under={under} unmatched={unmatched} unknown={unknown} />}
    </Suspense>
  );
}

/* ---------- No query, no filters: a start page ---------- */

async function StartPage({ s }: { s: SearchState }) {
  const session = await getSession().catch(() => null);
  const [counts, confNames, totals, popular] = await Promise.all([peopleFacetCounts({}), conferenceNames(), searchTotals(), getPopularSearches(session)]);
  const facetProps = { state: s, counts, total: totals.people, conferenceNames: confNames, workedAt: null, workedUnder: null, unmatched: { workedAt: null, workedUnder: null }, keywords: false };
  return (
    <SidebarLayout sidebarLabel="Search filters" sidebar={<FacetPanel variant="rail" formId="facets-rail" {...facetProps} />}>
      <NoQuery
        totals={totals}
        popular={popular}
        conferences={counts.conference}
        conferenceNames={confNames}
        filters={
          <FilterSheet
            applied={0}
            total={totals.people}
            showLabel={`Show ${plural(totals.people, "coach", "coaches")}`}
            emptyLabel="No coaches match these filters."
            clearHref="/search"
            formId="facets-sheet"
            className="w-full"
          >
            <FacetPanel variant="sheet" formId="facets-sheet" {...facetProps} />
          </FilterSheet>
        }
      />
    </SidebarLayout>
  );
}

/* ---------- Results ---------- */

async function Results({ s, at, under, unmatched, unknown }: { s: SearchState; at: OrgRef | null; under: PersonRef | null; unmatched: Unmatched; unknown: UnknownFacets }) {
  const session = await getSession().catch(() => null);
  const isPeople = s.type === "people";
  const names = { workedAt: at?.shortName ?? null, workedUnder: under?.fullName ?? null };
  const picked = { workedAt: at ? pickedOrg(at) : null, workedUnder: under ? pickedPerson(under) : null };
  const peopleCriteria = { q: s.q, role: s.role, division: s.division, conference: s.conference, state: s.state, workedAtOrgId: at?.id ?? null, workedUnderId: under?.id ?? null };
  const programCriteria = { q: s.q, division: s.division, conference: s.conference, state: s.state };

  const [peopleRes, programRes, otherCount, counts, confNames] = await Promise.all([
    isPeople ? searchPeopleX(peopleCriteria, s.page) : null,
    isPeople ? null : searchProgramsX(programCriteria, s.page),
    isPeople ? countPrograms(programCriteria) : countPeople(programCriteria),
    isPeople ? peopleFacetCounts(peopleCriteria) : programFacetCounts(programCriteria),
    conferenceNames(),
  ]);
  const total = (peopleRes ?? programRes)!.total;
  const peopleTotal = isPeople ? total : otherCount;
  const programTotal = isPeople ? otherCount : total;
  const [contexts, popular, allValues] = await Promise.all([
    peopleRes
      ? treeContexts(
          peopleRes.results.map((p) => ({ id: p.id, fullName: p.fullName, currentOrgId: p.orgId })),
          { workedAtOrgId: at?.id, workedUnderId: under?.id, viewerPersonId: session?.person?.id ?? null },
        )
      : new Map(),
    total === 0 ? getPopularSearches(session, 4) : [],
    // Nothing matches: the facets list every value as a disabled 0 row instead of vanishing.
    total === 0 ? (isPeople ? peopleFacetCounts({}) : programFacetCounts({})) : null,
  ]);
  const rowCount = (peopleRes ?? programRes)!.results.length;
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const pastEnd = total > 0 && rowCount === 0;
  const applied = appliedCount(s);
  const anyInferred = peopleRes?.results.some((p) => contextInferred(contexts.get(p.id))) ?? false;

  const noun = isPeople ? ["coach", "coaches"] : ["program", "programs"];
  const heading = s.q ? `${fmt(total)} ${total === 1 ? "result" : "results"} for ‘${s.q}’` : `${fmt(total)} ${describeFilters(s, names, total)}`;
  // A coach with no one under them: the filter can't list anyone, and the page says why.
  const noTree = !!under && under.mentees === 0;
  const note = under
    ? noTree
      ? null
      : `Coaches whose seasons overlapped with ${possessive(under.firstName)} as head coach on the same staff.`
    : at
      ? `Coaches with a stint at ${at.shortName}, current or past.`
      : null;
  const facetProps = { state: s, counts, total, allValues, conferenceNames: confNames, workedAt: picked.workedAt, workedUnder: picked.workedUnder, unmatched, keywords: false };
  // The header's search field submits a new query with the current tab and facets (audit X20: one
  // in-page search style; the query lives in the header, not in a Keywords facet).
  const keep = [...new URLSearchParams(searchHref(s, { q: "" }).split("?")[1] ?? "").entries()];
  const emptyLabel = s.q && !applied ? `No ${noun[1]} match ‘${s.q}’.` : `No ${noun[1]} match these filters.`;

  // A value that matches nothing is dropped, and says so at every width; Remove takes it out of the URL
  // and keeps every other value (dropped ones included, so each note goes away on its own).
  const kept = withDropped(s, unknown, unmatched);
  type Note = { key: string; facet: string; value: string; text: string; removeHref: string };
  const NOUN: Record<ValueFacet, string> = { division: "division", conference: "conference", state: "state" };
  const notes: Note[] = [
    ...(["division", "conference", "state"] as const).flatMap((k) =>
      unknown[k].map((v) => ({
        key: `${k}:${v}`,
        facet: VALUE_FACET_LABEL[k],
        value: v,
        text: `No ${NOUN[k]} matches ‘${v}’, so this list isn't filtered by ${VALUE_FACET_LABEL[k]}.`,
        removeHref: searchHref(without(kept, k, v)),
      })),
    ),
    ...(unmatched.workedAt
      ? [{ key: "at", facet: "Worked at", value: unmatched.workedAt, text: `No program matches ‘${unmatched.workedAt}’, so this list isn't filtered by Worked at.`, removeHref: searchHref({ ...kept, workedAt: s.workedAt }) }]
      : []),
    ...(unmatched.workedUnder
      ? [{ key: "under", facet: "Worked under", value: unmatched.workedUnder, text: `No coach matches ‘${unmatched.workedUnder}’, so this list isn't filtered by Worked under.`, removeHref: searchHref({ ...kept, workedUnder: s.workedUnder }) }]
      : []),
  ];

  return (
    <SidebarLayout sidebarLabel="Search filters" sidebar={<FacetPanel variant="rail" formId="facets-rail" {...facetProps} />}>
      <Card padding="none" aria-labelledby="search-heading">
        <div className="px-4 pt-4">
          <h1 id="search-heading" className="text-display-sm" aria-live="polite">
            {heading}
          </h1>
          {note && <p className="mt-0.5 text-small text-fg-2">{note}</p>}
          <form method="get" action="/search" role="search" aria-label="Search coaches and programs" className="mt-3">
            {keep.map(([k, v]) => (
              <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
            ))}
            <PageSearchField key={s.q} name="q" defaultValue={s.q} placeholder={s.type === "people" ? "Name, title or program" : "Name or conference"} aria-label="Search coaches and programs" />
          </form>
          {notes.map((n) => (
            <p key={n.key} role="note" className="mt-2 flex items-start gap-1.5 text-small text-fg-2">
              <Icon icon={Info} size={16} className="mt-px shrink-0 text-fg-2" />
              <span>
                {n.text}{" "}
                <TextLink href={n.removeHref} scroll={false} target24 aria-label={`Remove the unmatched ${n.facet} value ‘${n.value}’`}>
                  Remove
                </TextLink>
              </span>
            </p>
          ))}
          <div className="mt-3 flex min-w-0 items-center gap-2 lg:hidden">
            <FilterSheet applied={applied} total={total} showLabel={`Show ${plural(total, noun[0], noun[1])}`} emptyLabel={emptyLabel} clearHref={searchHref(cleared(s))} formId="facets-sheet">
              <FacetPanel variant="sheet" formId="facets-sheet" {...facetProps} />
            </FilterSheet>
            <AppliedFilters state={s} names={names} />
          </div>
        </div>
        <Tabs
          label="Result type"
          className="mt-2"
          items={[
            { href: searchHref({ ...s, type: "people" }), label: "People", count: peopleTotal, active: isPeople },
            // Programs ignore role and tree filters, so their count is left off while those apply.
            { href: searchHref({ ...s, type: "programs" }), label: "Programs", count: isPeople && peopleOnly(s) ? null : programTotal, active: !isPeople },
          ]}
        />

        <PendingRegion>
          {total === 0 && noTree && under ? (
            <EmptyState
              icon={SearchX}
              title={`No one is listed as working under ${under.firstName}.`}
              description={
                under.wasHeadCoach
                  ? `No assistant on the staffs we've read shares seasons with ${possessive(under.firstName)} time as head coach.`
                  : `${under.firstName} hasn't been a head coach on a staff we've read.`
              }
              action={<ButtonLink href={searchHref(s, { workedUnder: null })}>Remove Worked under</ButtonLink>}
              spacing="lg"
            />
          ) : total === 0 ? (
            <EmptyResults s={s} isPeople={isPeople} otherCount={otherCount} applied={applied} />
          ) : pastEnd ? (
            <EmptyState
              icon={SearchX}
              title={`Page ${s.page} is past the last page of results.`}
              description={`These results end on page ${totalPages}.`}
              action={<ButtonLink href={searchHref(s, { page: totalPages })}>Go to page {totalPages}</ButtonLink>}
            />
          ) : (
            <>
              <ul aria-label={isPeople ? "Coaches" : "Programs"} className="divide-y divide-divider">
                {peopleRes?.results.map((p) => (
                  <PersonResultRow key={p.id} person={p} context={contexts.get(p.id)} conferenceNames={confNames} isViewer={session?.person?.id === p.id} mentorNamed={!!under} orgNamed={!!at && !under} />
                ))}
                {programRes?.results.map((o) => <ProgramResultRow key={o.id} program={o} conferenceNames={confNames} />)}
              </ul>
              {anyInferred && <InferredFootnote className="border-t border-divider px-4 py-3" />}
              {totalPages > 1 && (
                <Pagination
                  className="border-t border-divider px-4 py-3"
                  page={s.page}
                  totalPages={totalPages}
                  prevHref={s.page > 1 ? searchHref(s, { page: s.page - 1 }) : null}
                  nextHref={s.page < totalPages ? searchHref(s, { page: s.page + 1 }) : null}
                />
              )}
            </>
          )}
        </PendingRegion>
      </Card>
      {popular.length > 0 && <PopularSearches items={popular} title="Try a suggested search" />}
    </SidebarLayout>
  );
}

function EmptyResults({ s, isPeople, otherCount, applied }: { s: SearchState; isPeople: boolean; otherCount: number; applied: number }) {
  const what = isPeople ? "coaches" : "programs";
  const title = s.q ? (otherCount === 0 ? `No coaches or programs match ‘${s.q}’.` : `No ${what} match ‘${s.q}’.`) : `No ${what} match these filters.`;
  const description = s.q ? "Try a last name, a school or a conference abbreviation." : "Remove a filter to widen the search.";
  const action =
    applied > 0 ? (
      <ButtonLink href={searchHref(cleared(s))}>Clear filters</ButtonLink>
    ) : otherCount > 0 ? (
      <ButtonLink href={searchHref({ ...s, type: isPeople ? "programs" : "people" })}>
        See {plural(otherCount, isPeople ? "program" : "coach", isPeople ? "programs" : "coaches")}
      </ButtonLink>
    ) : undefined;
  return <EmptyState icon={SearchX} title={title} description={description} action={action} spacing="lg" />;
}
