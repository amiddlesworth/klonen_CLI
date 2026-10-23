import Link from "next/link";
import type { ReactNode } from "react";
import { LevelBadge } from "@/components/data/Badges";
import { Chip, SampleChip } from "@/components/ui/Chip";
import { OrgMark } from "@/components/ui/OrgMark";
import { cn } from "@/lib/cn";
import { conferenceShort, salaryRange, timeAgo } from "@/lib/format";
import { ApplyButton } from "./ApplyButton";
import { UNIT_LABEL, isSampleJob, postedTitle, roleGroupLabel } from "./labels";
import { SaveJobButton } from "./SaveJobButton";

export type JobHeaderJob = {
  id: number;
  title: string;
  roleGroup: string;
  unit: string | null;
  employmentType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: Date | null;
  source: string;
  isDemo: boolean;
  org: { slug: string; name: string; shortName: string; city: string | null; state: string | null; conference: string | null; conferenceAbbr: string | null; level: string | null; inRegistry: boolean };
};

type JobHeaderProps = {
  job: JobHeaderJob;
  /** h1 on the job page, h2 in the /jobs detail pane. */
  headingLevel?: "h1" | "h2";
  /** Post-job preview: Apply and Save render inert. */
  preview?: boolean;
  /** Extra classes for the title (the pane uses display-sm). */
  titleClassName?: string;
  /** id for the title, so the surrounding region can be labelled by it. */
  titleId?: string;
  className?: string;
};

/**
 * Job detail header (§8.9): OrgMark 56 (48 on phone), title text-display, "Program · ST · Conf"
 * with the program linked to its page, chips (Sample listing, role group, unit, division), actions
 * Apply (the one primary) and Save, then a facts band: salary range, employment type, posted.
 */
export function JobHeader({ job, headingLevel = "h1", preview, titleClassName, titleId, className }: JobHeaderProps) {
  const H = headingLevel;
  const sample = isSampleJob(job);
  const salary = salaryRange(job.salaryMin, job.salaryMax);
  const place = [job.org.city, job.org.state].filter(Boolean).join(", ");
  const conf = conferenceShort(job.org.conferenceAbbr);
  const programName = job.org.name || job.org.shortName;

  return (
    <div className={className}>
      {/* The preview sits in a 360px column, so it always uses the stacked (phone) arrangement. */}
      <div className={cn("grid grid-cols-[48px_minmax(0,1fr)] gap-x-3", !preview && "md:grid-cols-[56px_minmax(0,1fr)_auto] md:gap-x-4")}>
        <OrgMark
          shortName={job.org.shortName || "?"}
          name={job.org.name}
          size={preview ? 48 : 56}
          className={preview ? undefined : "max-md:size-12 max-md:rounded-[10px] max-md:text-[16px]"}
        />
        <div className="min-w-0">
          <H id={titleId} className={cn("text-display-sm", !preview && "md:text-display", titleClassName)}>
            {job.title || "Job title"}
          </H>
          <p className={cn("mt-0.5 text-body text-fg-2", !preview && "md:text-subtitle")}>
            {job.org.inRegistry && !preview ? (
              <Link href={`/programs/${job.org.slug}`} className="target-24 font-medium text-fg-1 underline-offset-2 hover:underline">
                {programName}
              </Link>
            ) : (
              <span className="font-medium text-fg-1">{programName}</span>
            )}
            {place && <> · {place}</>}
            {conf && (
              <>
                {" · "}
                <abbr title={job.org.conference ?? conf}>{conf}</abbr>
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sample && <SampleChip label="Sample listing" />}
            <Chip>{roleGroupLabel(job.roleGroup)}</Chip>
            {job.unit && UNIT_LABEL[job.unit] && <Chip>{UNIT_LABEL[job.unit]}</Chip>}
            <LevelBadge level={job.org.level} />
          </div>
        </div>
        <div className={cn("col-span-full mt-4 flex gap-2", !preview && "md:col-span-1 md:col-start-3 md:row-start-1 md:mt-0 md:items-start")}>
          <ApplyButton jobTitle={job.title} programName={job.org.shortName} sample={job.source === "sample"} large preview={preview} className={preview ? "flex-1" : "max-md:flex-1"} />
          {preview ? (
            <span aria-hidden="true" className="grid h-11 flex-1 place-items-center rounded-sm border border-control bg-surface px-3 text-small font-medium text-fg-1 md:h-8">
              Save
            </span>
          ) : (
            <SaveJobButton jobId={job.id} title={job.title} variant="label" large className="max-md:flex-1" />
          )}
        </div>
      </div>
      <dl className={cn("mt-4 grid grid-cols-3 border-t border-divider", !preview && "md:mt-5")}>
        <Fact label="Salary range" value={salary ?? "Not listed"} muted={!salary} num compact={preview} />
        <Fact label="Employment" value={job.employmentType} compact={preview} />
        <Fact
          label="Posted"
          value={
            job.postedAt ? (
              <time dateTime={job.postedAt.toISOString()} title={postedTitle(job.postedAt)}>
                {timeAgo(job.postedAt)} ago
              </time>
            ) : (
              "Not yet"
            )
          }
          muted={!job.postedAt}
          compact={preview}
        />
      </dl>
    </div>
  );
}

function Fact({ label, value, muted, num, compact }: { label: string; value: ReactNode; muted?: boolean; num?: boolean; compact?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col py-3 [&+&]:border-l [&+&]:border-divider", compact ? "pr-1 [&+&]:pl-2.5" : "pr-3 max-md:pr-1 [&+&]:pl-4 max-md:[&+&]:pl-2.5")}>
      <dt className="order-2 text-caption text-fg-2">{label}</dt>
      <dd className={cn("order-1 font-semibold", compact ? "text-body" : "text-subtitle max-md:text-body", num && "num", muted && "font-normal text-fg-3")}>{value}</dd>
    </div>
  );
}
