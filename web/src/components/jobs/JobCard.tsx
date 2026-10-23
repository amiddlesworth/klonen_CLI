import Link from "next/link";
import type { ReactNode } from "react";
import { Bookmark, Briefcase } from "lucide-react";
import { LevelBadge } from "@/components/data/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { cn } from "@/lib/cn";
import { conferenceShort, salaryRange } from "@/lib/format";
import { LISTING_SEASON, hasRealPostedAt, jobPlace, postedLabel, postedTitle, roleGroupLabel } from "./labels";
import { ListingChip } from "./ListingChip";
import { PlaceLine } from "./PlaceLine";
import { SaveJobButton } from "./SaveJobButton";

export type JobCardJob = {
  id: number;
  title: string;
  /** Empty in the post-job preview until a role group is chosen (no chip then). */
  roleGroup: string;
  employmentType: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  postedAt?: Date | null;
  source: string;
  isDemo: boolean;
  /** Posted "City, ST" (optional; falls back to the program's place). */
  location?: string | null;
  org: {
    shortName: string;
    name: string;
    city: string | null;
    state: string | null;
    conferenceAbbr: string | null;
    /** Full conference name for the abbreviation's title. */
    conference?: string | null;
    level: string | null;
  };
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
   * "feed": the feed's JobCard (§8.5): the meta line first ("Job · Matches your position group").
   *   The caller supplies the frame (the feed item card, or a Card around the post-job preview).
   * "list": a row inside a list card (/jobs, the program Jobs tab): no "Job" line, and a line with
   *   the salary and when it was posted under the chips.
   * Everything else is the same component: meta line, chips, network proof and the actions.
   */
  layout?: "feed" | "list";
  /** The job page. */
  href: string;
  /** /jobs list/detail split: at lg the title selects the job into the pane (`/jobs?id=`). */
  selectHref?: string;
  selected?: boolean;
  /** Feed meta after "Job" ("Matches your position group"). */
  meta?: ReactNode;
  proof?: JobProof | null;
  /** Non-interactive copy for the post-job preview. */
  preview?: boolean;
  /** The signed-in athletic director's own listing: no Save (as on its page), "Your listing" in the list line. */
  owner?: boolean;
  headingLevel?: "h2" | "h3";
  /** id of the title, so a surrounding feed item can be labelled by it. */
  headingId?: string;
  className?: string;
};

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
 * JobCard (§8.5, §8.9, §8.13), the one card every job list uses: the feed, /jobs, the program Jobs
 * tab and the post-job preview (which therefore shows it exactly as the feed will). Org tile 40,
 * title 15/600 (linked), "{short name} · {City, ST} · {Conf} · {type}" 13 --fg-2, chips (the dashed
 * Sample listing or Demo listing first, then role group and division), optional network proof.
 *
 * The arrangement follows the card's own width, not the viewport: wide (content 32rem and up, a
 * card about 34rem across), Save and View job sit top-right; narrow, they become a row under the
 * chips with View job flexing to fill (44px on phone) and Save 44×44. In the /jobs split at lg, View job gives way to the detail pane and Save
 * stays top-right. Apply lives on the job page only.
 */
export function JobCard({ job, layout = "list", href, selectHref, selected, meta, proof, preview, owner, headingLevel = "h2", headingId, className }: JobCardProps) {
  const H = headingLevel;
  const Root = layout === "feed" || preview ? "div" : "article";
  const split = layout === "list" && !!selectHref && !preview;
  const salary = salaryRange(job.salaryMin ?? null, job.salaryMax ?? null);
  const conf = conferenceShort(job.org.conferenceAbbr);
  const place = jobPlace(job);
  const titleCls = "target-24 underline-offset-2 hover:underline";
  const label = `${job.title} at ${job.org.shortName}`;

  const title = preview ? (
    <span>{job.title || "Job title"}</span>
  ) : split ? (
    <>
      <Link href={selectHref!} scroll={false} aria-current={selected ? "true" : undefined} className={cn(titleCls, "hidden after:absolute after:inset-0 after:content-[''] lg:inline")}>
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

  const parts = [
    job.org.shortName,
    ...(place ? [place] : []),
    ...(conf
      ? [
          {
            node: (
              <abbr title={job.org.conference ?? conf} className="no-underline">
                {conf}
              </abbr>
            ),
            text: conf,
          },
        ]
      : []),
    job.employmentType,
  ];

  // Narrow: View job first and flexing, then Save. Wide: Save, then View job.
  // Narrow below a 32rem content width (phone, the low end of the feed column, the /jobs list, the post-job phone preview).
  const saveOrder = "order-2 flex @[32rem]:order-1";
  const viewOrder = "order-1 flex-1 @[32rem]:order-2 @[32rem]:flex-none";

  return (
    <Root
      aria-label={Root === "article" ? label : undefined}
      className={cn(
        "@container relative p-4",
        split && "transition-colors lg:hover:bg-surface-2",
        // Selected: --surface-2 plus a 2px ink bar (neutral chips use --hover, so the row never matches their fill).
        selected && "lg:bg-surface-2 lg:shadow-[inset_2px_0_0_var(--fg-1)]",
        className,
      )}
    >
      <div className={cn("grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 @[32rem]:grid-cols-[40px_minmax(0,1fr)_auto]", split && "lg:grid-cols-[40px_minmax(0,1fr)_auto]")}>
        <OrgMark shortName={job.org.shortName || "?"} name={job.org.name} size={40} />
        <div className="min-w-0">
          {layout === "feed" && (
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
          <H id={headingId} className={cn("text-subtitle font-semibold leading-5 text-fg-1", layout === "feed" && "mt-0.5")}>
            {title}
          </H>
          <p className="mt-0.5 text-small text-fg-2">
            <PlaceLine parts={parts} />
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <ListingChip job={job} />
            {job.roleGroup && <Chip>{roleGroupLabel(job.roleGroup)}</Chip>}
            <LevelBadge level={job.org.level} />
          </div>
          {layout === "list" && (
            <p className="mt-2 flex flex-wrap gap-x-1.5 text-caption text-fg-3">
              {salary && <span className="num font-medium text-fg-2">{salary}</span>}
              {salary && <span aria-hidden="true">·</span>}
              {/* Only a posted listing has a real time; samples read "2026 season" (§6.3, §11 rule 6). */}
              {job.postedAt && hasRealPostedAt({ source: job.source, postedAt: job.postedAt }) ? (
                <time dateTime={job.postedAt.toISOString()} title={postedTitle(job.postedAt)}>
                  {postedLabel(job.postedAt)}
                </time>
              ) : (
                <span className="num">{LISTING_SEASON}</span>
              )}
              {owner && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-fg-2">Your listing</span>
                </>
              )}
            </p>
          )}
          {proof && proof.people.length > 0 && <Proof proof={proof} />}
        </div>
        <div
          className={cn(
            "relative z-10 col-span-full mt-3 flex gap-2",
            "@[32rem]:col-span-1 @[32rem]:col-start-3 @[32rem]:row-start-1 @[32rem]:mt-0",
            split && "lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:mt-0",
            split && owner && "lg:hidden",
          )}
        >
          {preview ? (
            <>
              <span aria-hidden="true" className={cn(saveOrder, "size-11 place-items-center rounded-sm border border-control bg-surface text-fg-1 shadow-btn md:size-8")}>
                <Icon icon={Bookmark} size={16} className="m-auto" />
              </span>
              <span aria-hidden="true" className={cn(viewOrder, "grid h-11 place-items-center rounded-sm border border-control bg-surface px-3 text-small font-medium text-fg-1 shadow-btn md:h-8")}>
                View job
              </span>
            </>
          ) : (
            <>
              {!owner && (
                <span className={saveOrder}>
                  <SaveJobButton jobId={job.id} title={label} large />
                </span>
              )}
              <ButtonLink href={href} variant="secondary" phone="large" aria-label={`View job: ${label}`} className={cn(viewOrder, split && "lg:hidden")}>
                View job
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </Root>
  );
}
