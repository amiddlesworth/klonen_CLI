import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { descriptionSummary, parseDescription } from "@/components/jobs/description";
import { DescriptionBlocks } from "@/components/jobs/JobDescription";
import { JobHeader } from "@/components/jobs/JobHeader";
import { PostedToast } from "@/components/jobs/PostedToast";
import { ProgramCard } from "@/components/jobs/ProgramCard";
import { ProgramPeople, proofFor } from "@/components/jobs/ProgramPeople";
import { SimilarJobs } from "@/components/jobs/SimilarJobs";
import { BRAND } from "@/lib/brand";
import { countOpenJobs, getJobDetail, getNetworkProof, getProgramPeople, getSimilarJobs } from "@/lib/queries/jobsx";
import { getSession } from "@/lib/session";

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

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
 * Job page (§8.9): header card (OrgMark 56, title, program, chips, Apply + Save, facts), then one
 * card per description section (About the role, Responsibilities, Qualifications…) and the people
 * from this program on the network. Rail: the program card and similar jobs.
 */
export default async function JobPage({ params, searchParams }: PageProps) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const [job, session, sp] = await Promise.all([getJobDetail(id), getSession().catch(() => null), searchParams]);
  if (!job) notFound();

  const viewerPersonId = session?.user.kind === "coach" ? (session.person?.id ?? null) : null;
  const [staff, openJobs, similar, proof] = await Promise.all([
    getProgramPeople(job.org.id, 6),
    countOpenJobs(job.org.id),
    getSimilarJobs(job, 3),
    viewerPersonId ? getNetworkProof(viewerPersonId, job.org.id) : Promise.resolve(null),
  ]);
  const sections = parseDescription(job.description);
  const posted = sp.posted === "1" && session?.user.kind === "employer" && job.createdByUserId === session.user.id;

  return (
    <TwoColumnLayout
      railLabel="Program and similar jobs"
      breadcrumb={
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
            <li className="min-w-0">
              {job.org.inRegistry ? (
                <Link href={`/programs/${job.org.slug}`} className="target-24 underline-offset-2 hover:text-fg-1 hover:underline">
                  {job.org.shortName}
                </Link>
              ) : (
                job.org.shortName
              )}
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
          <ProgramCard org={job.org} staffCount={staff.total} openJobs={openJobs} />
          <SimilarJobs jobs={similar} roleGroup={job.roleGroup} />
        </>
      }
    >
      {posted && <PostedToast message={`Published "${job.title}" in the demo`} />}
      <Card padding="none" aria-labelledby="job-title">
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <JobHeader job={job} titleId="job-title" />
        </div>
        {job.status !== "open" && (
          <p role="note" className="border-t border-divider bg-surface-2 px-4 py-3 text-small text-fg-2 md:px-6">
            This listing is closed. It stays here so links to it keep working.
          </p>
        )}
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

      <ProgramPeople org={job.org} people={staff.people} total={staff.total} proof={proofFor(proof, job.org.shortName)} />
    </TwoColumnLayout>
  );
}
