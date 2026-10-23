import Link from "next/link";
import { Briefcase } from "lucide-react";
import { LevelBadge } from "@/components/data/Badges";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, SampleChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrgMark } from "@/components/ui/OrgMark";
import { ROLE_GROUP_LABEL, conferenceShort, salaryRange, type RoleGroup } from "@/lib/format";
import { getProgramJobs, type ProgramOrg } from "@/lib/queries/program";
import { jobsCount } from "./text";

type Job = Awaited<ReturnType<typeof getProgramJobs>>[number];

/**
 * Jobs tab (§8.6): JobCard rows in one card, split by dividers. Sample listings carry the dashed
 * "Sample listing" chip first. Empty: "No open jobs at {Program}." with one secondary action
 * (Post a job for the program's own athletic director, else Browse all jobs).
 */
export async function JobsTab({ org, canPost }: { org: ProgramOrg; canPost: boolean }) {
  const jobs = await getProgramJobs(org.id);
  const samples = jobs.filter(isSample).length;
  return (
    <Card padding="main" aria-labelledby="jobs-title">
      <CardHeader
        id="jobs-title"
        title="Open jobs"
        meta={jobs.length ? (samples === jobs.length ? `${jobs.length} sample ${jobs.length === 1 ? "listing" : "listings"}` : jobsCount(jobs.length)) : undefined}
      />
      {jobs.length ? (
        <ul className="divide-y divide-divider">
          {jobs.map((j) => (
            <li key={j.id} className="py-4 first:pt-1 last:pb-0">
              <ProgramJobCard job={j} org={org} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Briefcase}
          title={`No open jobs at ${org.shortName}.`}
          description={canPost ? "Post an opening and it shows up here and in the Jobs tab." : "Openings posted on the network show up here first."}
          action={canPost ? <ButtonLink href="/employers/jobs/new">Post a job</ButtonLink> : <ButtonLink href="/jobs">Browse all jobs</ButtonLink>}
          spacing="lg"
        />
      )}
    </Card>
  );
}

function isSample(j: Job) {
  return j.source === "sample" || j.isDemo;
}

/**
 * JobCard (§8.5) as a row: OrgMark 40, title 15/600 (linked), "Program · ST · Conf · Full-time ·
 * pay" 13 --fg-2, chips (Sample listing first, role group, division), View job (secondary) top
 * right; on phone the action becomes a full-width 44px row under the text.
 */
function ProgramJobCard({ job, org }: { job: Job; org: ProgramOrg }) {
  const conf = conferenceShort(org.conferenceAbbr);
  const meta = [org.shortName, job.location ?? org.state, conf, job.employmentType, salaryRange(job.salaryMin, job.salaryMax)].filter(Boolean);
  return (
    <article aria-labelledby={`job-${job.id}`} className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 gap-y-3 md:grid-cols-[40px_minmax(0,1fr)_auto]">
      <OrgMark shortName={org.shortName} name={org.name} size={40} />
      <div className="min-w-0">
        <h3 id={`job-${job.id}`} className="text-subtitle font-semibold">
          <Link href={`/jobs/${job.id}`} className="target-24 rounded-xs underline-offset-2 hover:underline">
            {job.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-small text-fg-2">{meta.join(" · ")}</p>
        <p className="mt-2 flex flex-wrap items-center gap-1">
          {isSample(job) && <SampleChip label="Sample listing" />}
          <Chip>{ROLE_GROUP_LABEL[job.roleGroup as RoleGroup] ?? "Coaching staff"}</Chip>
          <LevelBadge level={org.level} />
        </p>
      </div>
      <ButtonLink href={`/jobs/${job.id}`} phone="large" className="col-span-2 md:col-span-1 md:col-start-3 md:row-start-1" aria-label={`View job: ${job.title}`}>
        View job
      </ButtonLink>
    </article>
  );
}
