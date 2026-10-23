import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchX } from "lucide-react";
import { InferredFootnote } from "@/components/data/InferredYear";
import { AppliedFilters } from "@/components/search/AppliedFilters";
import { FacetPanel } from "@/components/search/FacetPanel";
import { FilterSheet } from "@/components/search/FilterSheet";
import type { PickedEntity } from "@/components/search/EntityPicker";
import { NoQuery } from "@/components/search/NoQuery";
import { appliedCount, capitalize, cleared, describeFilters, hasCriteria, parseSearchParams, peopleOnly, plural, searchHref, type RawParams, type SearchState } from "@/components/search/params";
import { getPopularSearches } from "@/components/search/popular";
import { PopularSearches } from "@/components/search/PopularSearches";
import { PersonResultRow, ProgramResultRow } from "@/components/search/ResultRows";
import { contextInferred } from "@/components/search/TreeContextLine";
import { SidebarLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { BRAND } from "@/lib/brand";
import { levelShort } from "@/lib/format";
import {
  SEARCH_PAGE_SIZE,
  conferenceNames,
  countPeople,
  countPrograms,
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

const fmt = (n: number) => n.toLocaleString("en-US");

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const s = parseSearchParams(await searchParams);
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
  return { slug: o.slug, name: o.shortName, shortName: o.shortName, meta: [levelShort(o.level), o.conference].filter(Boolean).join(" · ") || null };
}

function pickedPerson(p: PersonRef): PickedEntity {
  return { slug: p.slug, name: p.fullName, meta: [p.currentTitle, p.orgShortName].filter(Boolean).join(" · ") || null };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const raw = parseSearchParams(await searchParams);
  const session = await getSession().catch(() => null);
  const isPeople = raw.type === "people";

  // "Worked at" / "Worked under" take slugs. Free text (the no-JS form) resolves to the best match
  // and redirects to the canonical URL; text that matches nothing is reported in the facet.
  const [at, under] = await Promise.all([
    isPeople && raw.workedAt ? getOrgRef(raw.workedAt) : null,
    isPeople && raw.workedUnder ? getPersonRef(raw.workedUnder) : null,
  ]);
  if (isPeople && ((raw.workedAt && !at) || (raw.workedUnder && !under))) {
    const [foundAt, foundUnder] = await Promise.all([raw.workedAt && !at ? findOrgByText(raw.workedAt) : null, raw.workedUnder && !under ? findPersonByText(raw.workedUnder) : null]);
    if (foundAt || foundUnder) {
      redirect(searchHref(raw, { workedAt: (at ?? foundAt)?.slug ?? raw.workedAt, workedUnder: (under ?? foundUnder)?.slug ?? raw.workedUnder, page: raw.page }));
    }
  }
  const unmatched = {
    workedAt: isPeople && raw.workedAt && !at ? raw.workedAt : null,
    workedUnder: isPeople && raw.workedUnder && !under ? raw.workedUnder : null,
  };

  // The Programs tab never carries people-only filters.
  const s: SearchState = isPeople ? { ...raw, workedAt: at?.slug ?? null, workedUnder: under?.slug ?? null } : { ...raw, role: [], workedAt: null, workedUnder: null };
  const names = { workedAt: at?.shortName ?? null, workedUnder: under?.fullName ?? null };
  const picked = { workedAt: at ? pickedOrg(at) : null, workedUnder: under ? pickedPerson(under) : null };

  const peopleCriteria = { q: s.q, role: s.role, division: s.division, conference: s.conference, state: s.state, workedAtOrgId: at?.id ?? null, workedUnderId: under?.id ?? null };
  const programCriteria = { q: s.q, division: s.division, conference: s.conference, state: s.state };

  /* ---------- No query, no filters: a start page ---------- */
  if (!hasCriteria(s) && !unmatched.workedAt && !unmatched.workedUnder) {
    const [counts, confNames, totals, popular] = await Promise.all([peopleFacetCounts({}), conferenceNames(), searchTotals(), getPopularSearches(session)]);
    return (
      <SidebarLayout
        sidebarLabel="Search filters"
        sidebar={<FacetPanel variant="rail" formId="facets-rail" state={s} counts={counts} conferenceNames={confNames} workedAt={null} workedUnder={null} unmatched={unmatched} keywords={false} />}
      >
        <NoQuery totals={totals} popular={popular} conferences={counts.conference} conferenceNames={confNames} />
      </SidebarLayout>
    );
  }

  /* ---------- Results ---------- */
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
  const contexts = peopleRes
    ? await treeContexts(
        peopleRes.results.map((p) => p.id),
        { workedAtOrgId: at?.id, workedUnderId: under?.id, viewerPersonId: session?.person?.id ?? null },
      )
    : new Map();
  const rowCount = (peopleRes ?? programRes)!.results.length;
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const pastEnd = total > 0 && rowCount === 0;
  const applied = appliedCount(s);
  const anyInferred = peopleRes?.results.some((p) => contextInferred(contexts.get(p.id))) ?? false;
  const popular = total === 0 ? await getPopularSearches(session, 4) : [];

  const noun = isPeople ? ["coach", "coaches"] : ["program", "programs"];
  const heading = s.q ? `${fmt(total)} ${total === 1 ? "result" : "results"} for ‘${s.q}’` : `${fmt(total)} ${describeFilters(s, names, total)}`;
  const note = under
    ? `Coaches whose seasons overlapped with ${under.firstName}'s as head coach on the same staff.`
    : at
      ? `Coaches with a stint at ${at.shortName}, current or past.`
      : null;
  const facetProps = { state: s, counts, conferenceNames: confNames, workedAt: picked.workedAt, workedUnder: picked.workedUnder, unmatched };

  return (
    <SidebarLayout sidebarLabel="Search filters" sidebar={<FacetPanel variant="rail" formId="facets-rail" {...facetProps} />}>
      <Card padding="none" aria-labelledby="search-heading">
        <div className="px-4 pt-4">
          <h1 id="search-heading" className="text-title" aria-live="polite">
            {heading}
          </h1>
          {note && <p className="mt-0.5 text-small text-fg-2">{note}</p>}
          <div className="mt-3 flex min-w-0 items-center gap-2 lg:hidden">
            <FilterSheet
              applied={applied}
              showLabel={`Show ${plural(total, noun[0], noun[1])}`}
              clearHref={searchHref(cleared(s))}
              formId="facets-sheet"
            >
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

        {total === 0 ? (
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
            {anyInferred && <InferredFootnote className="border-t border-divider px-4 py-3">Dotted years are inferred from a staff bio, not stated in it.</InferredFootnote>}
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
      </Card>
      {popular.length > 0 && <PopularSearches items={popular} title="Try a popular search" />}
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
