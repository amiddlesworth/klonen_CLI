import { Briefcase } from "lucide-react";
import { JobCard, type JobCardJob } from "@/components/jobs/JobCard";
import { listingKind } from "@/components/jobs/labels";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { getJobAlertOrgIds, getProgramJobs, type ProgramOrg } from "@/lib/queries/program";
import { JobAlertButton } from "./JobAlertButton";
import { jobsCount } from "./text";

type Job = Awaited<ReturnType<typeof getProgramJobs>>[number];

/**
 * Jobs tab (§8.6): the shared JobCard rows (Save + View job, Sample or Demo listing chip first,
 * salary line) in one card, split by dividers, so a job looks the same here as on /jobs and in the feed. Empty: "No open
 * jobs at {Program}." with a secondary "Set a job alert" (the program's own athletic director posts
 * from the header instead).
 */
export async function JobsTab({ org, canPost, userId }: { org: ProgramOrg; canPost: boolean; userId?: string | null }) {
  const jobs = await getProgramJobs(org.id);
  const alertOn = !jobs.length && !canPost && (await getJobAlertOrgIds(userId)).includes(org.id);
  const kinds = new Set(jobs.map((j) => listingKind(j)));
  // "2 sample listings" / "1 demo listing" when every open job is one kind of non-real listing.
  const onlyKind = kinds.size === 1 ? [...kinds][0] : null;
  return (
    <Card padding="main" aria-labelledby="jobs-title">
      <CardHeader
        id="jobs-title"
        title="Open jobs"
        meta={jobs.length ? (onlyKind ? `${jobs.length} ${onlyKind} ${jobs.length === 1 ? "listing" : "listings"}` : jobsCount(jobs.length)) : undefined}
      />
      {jobs.length ? (
        <ul className="divide-y divide-divider">
          {jobs.map((j, i) => (
            <li key={j.id}>
              <JobCard
                layout="list"
                job={toJobCard(j, org)}
                href={`/jobs/${j.id}`}
                headingLevel="h3"
                // The card already pads its content; rows keep the card's edges and the list rhythm.
                className={cn("px-0 py-4 md:px-0", i === 0 && "pt-1", i === jobs.length - 1 && "pb-0")}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Briefcase}
          title={`No open jobs at ${org.shortName}.`}
          description={canPost ? "Post an opening and it shows up here and on the Jobs page." : "Set an alert to hear when one is posted."}
          // The program's own AD already has "Post a job" as the header's primary action; no second copy here.
          action={canPost ? undefined : <JobAlertButton orgId={org.id} shortName={org.shortName} initialOn={alertOn} />}
          spacing="lg"
        />
      )}
    </Card>
  );
}

/** JobCard data for a job at this program (the same meta line as /jobs and the feed: "Pacific (OR) · OR · NWC · Full-time"). */
function toJobCard(j: Job, org: ProgramOrg): JobCardJob {
  return {
    id: j.id,
    title: j.title,
    roleGroup: j.roleGroup,
    employmentType: j.employmentType,
    salaryMin: j.salaryMin,
    salaryMax: j.salaryMax,
    postedAt: j.postedAt,
    source: j.source,
    isDemo: j.isDemo,
    location: j.location,
    org: {
      shortName: org.shortName,
      name: org.name,
      city: org.city,
      state: org.state,
      conferenceAbbr: org.conferenceAbbr,
      conference: org.conference,
      level: org.level,
    },
  };
}
