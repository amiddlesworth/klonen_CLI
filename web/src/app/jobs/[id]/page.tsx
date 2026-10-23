import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { closeApplySections, descriptionSummary, jobSections } from "@/components/jobs/description";
import { DescriptionBlocks } from "@/components/jobs/JobDescription";
import { JobHeader } from "@/components/jobs/JobHeader";
import { JobNotes } from "@/components/jobs/JobNotes";
import { ProgramCard } from "@/components/jobs/ProgramCard";
import { ProgramPeople, proofFor } from "@/components/jobs/ProgramPeople";
import { SimilarJobs } from "@/components/jobs/SimilarJobs";
import { isOpenJob } from "@/components/jobs/labels";
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
  const sample = job.isDemo || job.source === "sample";
  return {
    title: `${job.title} at ${job.org.shortName}`,
    description: `${sample ? "Sample listing. " : ""}${descriptionSummary(job.description) || `${job.title} at ${job.org.name}.`}`,
    // Sample listings are demo data: keep them out of search engines.
    robots: sample ? { index: false, follow: true } : undefined,
    openGraph: { title: `${job.title} at ${job.org.shortName} · ${BRAND.name}` },
  };
}

/**
 * Job page (§8.9): header card (OrgMark 56, title, program, chips, Apply + Save, facts, then note
 * bands: closed, sample, or "Your listing"), one card per description section (About the role,
 * Responsibilities, Qualifications…) and the people from this program on the network. Rail: the
 * program card and similar jobs. The athletic director who posted the listing gets the owner view.
 * A closed listing keeps its page: no Apply, and How to apply says it is closed instead of linking.
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
  const parsed = jobSections(job.description);
  const sections = isOpenJob(job) ? parsed : closeApplySections(parsed, job.org.shortName);

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
          <ProgramCard org={job.org} counts={counts} />
          <SimilarJobs jobs={similar} roleGroup={job.roleGroup} />
        </>
      }
    >
      <Card padding="none" aria-labelledby="job-title" className="overflow-hidden">
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <JobHeader job={job} titleId="job-title" owner={owner} employer={session?.user.kind === "employer"} pipelineListId={pipelineListId} />
        </div>
        <JobNotes job={job} owner={owner} />
      </Card>

      {sections.length === 0 && (
        <Card padding="main" aria-labelledby="job-section-empty">
          <CardHeader id="job-section-empty" title="About the role" />
          <EmptyState icon={FileText} title="No description yet." description={`${job.org.shortName} hasn't added details for this role.`} spacing="sm" />
        </Card>
      )}
      {sections.map((s, i) => (
        <Card key={i} padding="main" aria-labelledby={`job-section-${i}`}>
          <CardHeader id={`job-section-${i}`} title={s.heading ?? "About the role"} />
          <DescriptionBlocks blocks={s.blocks} />
        </Card>
      ))}

      <ProgramPeople org={job.org} network={network} proof={proofFor(proof, job.org.shortName, { ownProgram })} />
    </TwoColumnLayout>
  );
}
