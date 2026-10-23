import type { Metadata } from "next";
import { Briefcase, Plus, SearchX } from "lucide-react";
import { PageContainer } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { JobCard } from "@/components/jobs/JobCard";
import { JobDetailPane } from "@/components/jobs/JobDetailPane";
import { JobFilters } from "@/components/jobs/JobFilters";
import { hasFilters, jobsHref, parseJobsQuery, roleGroupLabel } from "@/components/jobs/labels";
import { proofFor } from "@/components/jobs/ProgramPeople";
import { isJobOwner, viewerContext } from "@/components/jobs/viewer";
import { BRAND } from "@/lib/brand";
import { getJobDetail, getJobFacets, getNetworkProof, getProgramNetwork, searchJobs, type JobsFilter } from "@/lib/queries/jobsx";
import { getSession } from "@/lib/session";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const q = parseJobsQuery(await searchParams);
  const title = q.q ? `Jobs matching "${q.q}"` : "Jobs";
  return {
    title,
    description: `Open coaching and staff jobs at NCAA Division III football programs on ${BRAND.name}.`,
  };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Jobs (§8.9): h1 and filters, then the list. At lg and up the list sits left and the selected
 * job right: `?id=` when that job is on this page of results, else the first, so the pane never
 * shows a job the list doesn't contain. Below lg it is the list only and each job opens its page.
 */
export default async function JobsPage({ searchParams }: PageProps) {
  const query = parseJobsQuery(await searchParams);
  const filter: JobsFilter = { roles: query.roles, states: query.states, conferences: query.conferences, q: query.q };
  const [result, facets, session] = await Promise.all([searchJobs(filter, query.page), getJobFacets(filter, roleGroupLabel), getSession().catch(() => null)]);

  const selectedId = (result.jobs.find((j) => j.id === query.id) ?? result.jobs[0])?.id;
  const selected = selectedId ? await getJobDetail(selectedId) : null;

  const { viewerPersonId, viewerOrgId } = viewerContext(session);
  const [network, proof] = selected
    ? await Promise.all([
        getProgramNetwork(selected.org.id, { viewerPersonId }),
        viewerPersonId ? getNetworkProof(viewerPersonId, selected.org.id) : Promise.resolve(null),
      ])
    : [null, null];

  const filtered = hasFilters(query);
  const isEmployer = session?.user.kind === "employer";
  const countLine =
    result.total === 0
      ? null
      : `${plural(result.total, "open job", "open jobs")}${result.samples ? ` · ${plural(result.samples, "sample listing", "sample listings")}` : ""}`;

  return (
    <PageContainer>
      <Card padding="main" aria-labelledby="jobs-title">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="jobs-title" className="text-display-sm md:text-display">
              Jobs
            </h1>
            <p className="mt-0.5 text-small text-fg-2">Openings at Division III football programs. Sample listings are labeled.</p>
          </div>
          {isEmployer && (
            <ButtonLink href="/employers/jobs/new" icon={Plus} variant="secondary" className="max-md:hidden">
              Post a job
            </ButtonLink>
          )}
        </div>
        {isEmployer && (
          // Phone: the athletic director's way in, full width under the subtitle (44px).
          <ButtonLink href="/employers/jobs/new" icon={Plus} variant="secondary" phone="large" fullWidth className="-mt-1 mb-4 md:hidden">
            Post a job
          </ButtonLink>
        )}
        <JobFilters query={query} facets={facets} />
      </Card>

      {result.total === 0 ? (
        <Card padding="main" aria-label="Job results">
          <EmptyState
            icon={filtered ? SearchX : Briefcase}
            title={filtered ? "No jobs match these filters." : "No open jobs yet."}
            description={filtered ? "Try fewer filters or a different keyword." : "New openings at Division III programs show up here first."}
            action={
              filtered ? (
                <ButtonLink href="/jobs" scroll={false}>
                  Clear filters
                </ButtonLink>
              ) : undefined
            }
            spacing="lg"
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2 md:gap-3 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start lg:gap-3">
          <Card as="section" aria-labelledby="jobs-results-title" className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-divider px-4 py-3">
              <h2 id="jobs-results-title" className="text-body font-semibold">
                {filtered ? "Matching jobs" : "All open jobs"}
              </h2>
              {countLine && <p className="num text-small text-fg-3">{countLine}</p>}
            </div>
            <ul className="divide-y divide-divider">
              {result.jobs.map((j) => (
                <li key={j.id}>
                  <JobCard
                    job={j}
                    href={`/jobs/${j.id}`}
                    selectHref={jobsHref(query, { id: j.id })}
                    selected={selected?.id === j.id}
                    headingLevel="h3"
                  />
                </li>
              ))}
            </ul>
            {result.totalPages > 1 && (
              <div className="border-t border-divider px-4 py-3">
                <Pagination
                  page={result.page}
                  totalPages={result.totalPages}
                  prevHref={result.page > 1 ? jobsHref(query, { page: result.page - 1, id: null }) : null}
                  nextHref={result.page < result.totalPages ? jobsHref(query, { page: result.page + 1, id: null }) : null}
                />
              </div>
            )}
          </Card>
          {selected && network && (
            <JobDetailPane
              job={selected}
              network={network}
              owner={isJobOwner(session, selected)}
              proof={proofFor(proof, selected.org.shortName, { ownProgram: !!viewerPersonId && viewerOrgId === selected.org.id })}
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}
