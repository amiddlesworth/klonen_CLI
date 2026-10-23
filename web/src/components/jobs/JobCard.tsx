import Link from "next/link";
import type { ReactNode } from "react";
import { Bookmark, Briefcase } from "lucide-react";
import { LevelBadge } from "@/components/data/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Chip, SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { cn } from "@/lib/cn";
import { salaryRange } from "@/lib/format";
import { LISTING_SEASON, hasRealPostedAt, isSampleJob, jobSubline, postedLabel, postedTitle, roleGroupLabel } from "./labels";
import { SaveJobButton } from "./SaveJobButton";

export type JobCardJob = {
  id: number;
  title: string;
  roleGroup: string;
  employmentType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: Date | null;
  source: string;
  isDemo: boolean;
  /** Posted "City, ST" (optional; falls back to the program's place). */
  location?: string | null;
  org: { shortName: string; name: string; city: string | null; state: string | null; conferenceAbbr: string | null; level: string | null };
};

export type JobProof = {
  people: { name: string; slug: string }[];
  sentence: string;
  /** The viewer's own program: "{program} · your program", shown above the sentence (§8.3 ContextStrip). */
  strip?: { subject: string; reason: string } | null;
};

type JobCardProps = {
  job: JobCardJob;
  /**
   * "row": a row inside the jobs list card (divider-separated, 16px padding).
   * "card": the feed's JobCard frame (meta line first, network proof), used by the post-job preview.
   */
  variant?: "row" | "card";
  /** The job page. */
  href: string;
  /** Desktop list/detail split: the title selects the job into the pane (`/jobs?id=`) at lg and up. */
  selectHref?: string;
  selected?: boolean;
  /** Card variant meta line after "Job" ("Matches your position group"). */
  meta?: ReactNode;
  proof?: JobProof | null;
  /** Non-interactive copy for the post-job preview. */
  preview?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
};

function Chips({ job }: { job: JobCardJob }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {isSampleJob(job) && <SampleChip label="Sample listing" />}
      {/* The post-job preview has no role group until one is chosen, so it shows no chip for it. */}
      {job.roleGroup && <Chip>{roleGroupLabel(job.roleGroup)}</Chip>}
      <LevelBadge level={job.org.level} />
    </div>
  );
}

function Proof({ proof }: { proof: JobProof }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-caption text-fg-2">
      <span className="flex shrink-0 gap-1">
        {proof.people.slice(0, 3).map((p) => (
          <Avatar key={p.slug} name={p.name} tintKey={p.slug} size={24} />
        ))}
      </span>
      <span className="min-w-0">{proof.sentence}</span>
    </div>
  );
}

/**
 * JobCard (§8.5, §8.9): org tile 40, title 15/600 (linked), "Program · ST · Conf · Full-time",
 * chips (Sample listing first when the job is a sample, then role group and division), optional
 * network proof. Actions: Save (icon, aria-pressed) and View job (secondary); on phone they become
 * a bottom row with View job full width (44px) and Save 44×44. Apply lives on the job page only.
 */
export function JobCard({ job, variant = "row", href, selectHref, selected, meta, proof, preview, headingLevel = "h2", className }: JobCardProps) {
  const H = headingLevel;
  const salary = salaryRange(job.salaryMin, job.salaryMax);
  const titleCls = "underline-offset-2 hover:underline target-24";
  const stretched = "after:absolute after:inset-0 after:content-['']";

  const title = preview ? (
    <span>{job.title || "Job title"}</span>
  ) : selectHref ? (
    <>
      <Link href={selectHref} scroll={false} aria-current={selected ? "true" : undefined} className={cn(titleCls, stretched, "hidden lg:inline")}>
        {job.title}
      </Link>
      <Link href={href} className={cn(titleCls, "lg:hidden")}>
        {job.title}
      </Link>
    </>
  ) : (
    <Link href={href} className={titleCls}>
      {job.title}
    </Link>
  );

  return (
    <article
      aria-label={preview ? undefined : job.title}
      className={cn(
        // The preview sits in a 360px column, so it always uses the stacked (phone) arrangement.
        "relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 p-4",
        !preview && "md:grid-cols-[40px_minmax(0,1fr)_auto]",
        variant === "row" && "transition-colors",
        variant === "row" && selectHref && "lg:hover:bg-surface-2",
        // Selected: --surface-2 plus a 2px ink bar (neutral chips use --hover, so the row never matches their fill).
        selected && "lg:bg-surface-2 lg:shadow-[inset_2px_0_0_var(--fg-1)]",
        className,
      )}
    >
      <OrgMark shortName={job.org.shortName} name={job.org.name} size={40} />
      <div className="min-w-0">
        {variant === "card" && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-fg-3">
            <span className="inline-flex items-center gap-1 font-medium text-fg-2">
              <Icon icon={Briefcase} size={12} />
              Job
            </span>
            {meta && (
              <>
                <span aria-hidden="true">·</span>
                <span>{meta}</span>
              </>
            )}
          </p>
        )}
        <H className={cn("text-subtitle font-semibold leading-5 text-fg-1", variant === "card" && "mt-0.5")}>{title}</H>
        <p className="mt-0.5 text-small text-fg-2">{jobSubline(job)}</p>
        <Chips job={job} />
        {variant === "row" && (
          <p className="mt-2 flex flex-wrap gap-x-1.5 text-caption text-fg-3">
            {salary && <span className="num font-medium text-fg-2">{salary}</span>}
            {salary && <span aria-hidden="true">·</span>}
            {/* Only a posted listing has a real time; samples read "2026 season" (§6.3, §11 rule 6). */}
            {hasRealPostedAt(job) ? (
              <time dateTime={job.postedAt.toISOString()} title={postedTitle(job.postedAt)}>
                {postedLabel(job.postedAt)}
              </time>
            ) : (
              <span className="num">{LISTING_SEASON}</span>
            )}
          </p>
        )}
        {proof && proof.people.length > 0 && <Proof proof={proof} />}
      </div>
      <div className={cn("relative z-10 col-span-full mt-3 flex gap-2", !preview && "md:col-span-1 md:col-start-3 md:row-start-1 md:mt-0 md:items-start")}>
        {preview ? (
          <>
            <span aria-hidden="true" className="grid h-11 flex-1 place-items-center rounded-sm border border-control bg-surface text-small font-medium text-fg-1 md:h-8">
              View job
            </span>
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-sm border border-control bg-surface text-fg-1 md:size-8">
              <Icon icon={Bookmark} size={16} />
            </span>
          </>
        ) : (
          <>
            <SaveJobButton jobId={job.id} title={job.title} large wrapperClassName="md:order-first" />
            <ButtonLink href={href} variant="secondary" phone="large" className={cn("order-first flex-1 md:order-none md:flex-none", selectHref && "lg:hidden")}>
              View job
            </ButtonLink>
          </>
        )}
      </div>
    </article>
  );
}
