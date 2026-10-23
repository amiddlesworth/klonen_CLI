import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import type { JobListItem } from "@/lib/queries/jobsx";
import { isSampleJob, jobSublineParts, jobsHref } from "./labels";
import { PlaceLine } from "./PlaceLine";

/** Rail card "Similar jobs" (§8.9): tile 32, title (whole row links), "Program · ST · Conf", Sample chip. Hidden when empty. */
export function SimilarJobs({ jobs, roleGroup }: { jobs: JobListItem[]; roleGroup: string }) {
  if (!jobs.length) return null;
  return (
    <Card padding="rail" aria-labelledby="similar-jobs-title">
      <CardHeader
        id="similar-jobs-title"
        size="rail"
        title="Similar jobs"
        action={
          <TextLink href={jobsHref({ roles: [roleGroup] })} arrow target24 className="text-small">
            See all
          </TextLink>
        }
      />
      <ul className="mt-2">
        {jobs.map((j) => (
          <li key={j.id} className="border-t border-divider first:border-t-0">
            <Link href={`/jobs/${j.id}`} className="group/row flex min-h-11 items-start gap-3 py-2.5">
              <OrgMark shortName={j.org.shortName} name={j.org.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block text-small font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{j.title}</span>
                <PlaceLine parts={jobSublineParts(j, { type: false })} className="block text-caption text-fg-2" />
                {isSampleJob(j) && <SampleChip label="Sample listing" className="mt-1" />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
