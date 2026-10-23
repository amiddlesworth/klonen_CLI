import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CurrentProgramCard } from "@/components/data/CurrentProgramCard";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import { Icon } from "@/components/ui/Icon";
import { descriptionSummary } from "@/components/jobs/description";
import { JobDetailBody } from "@/components/jobs/JobDetailBody";
import { proofFor } from "@/components/jobs/ProgramPeople";
import { SimilarJobs } from "@/components/jobs/SimilarJobs";
import { LISTING_LABEL, listingKind } from "@/components/jobs/labels";
import { isJobOwner, viewerContext } from "@/components/jobs/viewer";
import { BRAND } from "@/lib/brand";
import { getJobDetail, getListingPipelineId, getNetworkProof, getProgramCounts, getProgramNetwork, getSimilarJobs } from "@/lib/queries/jobsx";
import { getSession } from "@/lib/session";

type PageProps = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = parseId((await params).id);
  const job = id ? await getJobDetail(id) : null;
  if (!job) return { title: "Job not found" };
  const kind = listingKind(job);
  return {
    title: `${job.title} at ${job.org.shortName}`,
    description: `${kind ? `${LISTING_LABEL[kind]}. ` : ""}${descriptionSummary(job.description) || `${job.title} at ${job.org.name}.`}`,
    // Sample and demo listings are not real openings: keep them out of search engines.
    robots: kind ? { index: false, follow: true } : undefined,
    openGraph: { title: `${job.title} at ${job.org.shortName} · ${BRAND.name}` },
  };
}

/**
 * Job page (§8.9): the shared job detail (JobDetailBody, also the /jobs pane) as one card per part.
 * Rail: the program card (the same Current program card as the profile rail) and similar jobs. The
 * athletic director who posted the listing gets the owner view. A closed listing keeps its page.
 */
export default async function JobPage({ params }: PageProps) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const [job, session] = await Promise.all([getJobDetail(id), getSession().catch(() => null)]);
  if (!job) notFound();

  const { viewerPersonId, viewerOrgId } = viewerContext(session);
  const ownProgram = !!viewerPersonId && viewerOrgId === job.org.id;
  const owner = isJobOwner(session, job);
  const [network, counts, similar, proof, pipelineListId] = await Promise.all([
    getProgramNetwork(job.org.id, { viewerPersonId }),
    getProgramCounts(job.org.id),
    getSimilarJobs(job, 3),
    viewerPersonId ? getNetworkProof(viewerPersonId, job.org.id) : Promise.resolve(null),
    owner && session ? getListingPipelineId(session.user.id, job) : Promise.resolve(null),
  ]);
  return (
    <TwoColumnLayout
      railLabel="Program and similar jobs"
      breadcrumb={
        // Each crumb is a real parent: the job sits directly under Jobs (the program is linked in the header).
        <nav aria-label="Breadcrumb">
          <ol className="flex min-w-0 items-center gap-1 text-small text-fg-2">
            <li>
              <Link href="/jobs" className="target-24 underline-offset-2 hover:text-fg-1 hover:underline">
                Jobs
              </Link>
            </li>
            <li aria-hidden="true">
              <Icon icon={ChevronRight} size={14} className="text-fg-3" />
            </li>
            <li className="min-w-0 truncate text-fg-1" aria-current="page">
              {job.title}
            </li>
          </ol>
        </nav>
      }
      rail={
        <>
          <CurrentProgramCard org={job.org} counts={counts} title="Program" />
          <SimilarJobs jobs={similar} roleGroup={job.roleGroup} />
        </>
      }
    >
      <JobDetailBody
        frame="page"
        job={job}
        network={network}
        proof={proofFor(proof, job.org.shortName, { ownProgram })}
        owner={owner}
        employer={session?.user.kind === "employer"}
        pipelineListId={pipelineListId}
      />
    </TwoColumnLayout>
  );
}
