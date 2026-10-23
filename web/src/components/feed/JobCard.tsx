import Link from "next/link";
import { Briefcase } from "lucide-react";
import { DemoLabel, LevelBadge } from "@/components/data/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { ROLE_GROUP_LABEL, type RoleGroup } from "@/lib/format";
import type { FeedJob } from "@/lib/queries/feedx";
import { FeedArticle } from "./FeedArticle";
import { Sep } from "./ItemParts";
import { SaveJobButton } from "@/components/jobs/SaveJobButton";

function networkSentence(net: NonNullable<FeedJob["network"]>): string {
  const names = net.people.map((p) => p.fullName);
  const others = net.total - names.length;
  const list = others > 0 ? `${names.join(", ")} and ${others} ${others === 1 ? "other" : "others"}` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `Your ${net.total === 1 ? "colleague" : "colleagues"} ${list} ${net.verb} here`;
}

// The layout follows the card's width, not the viewport (the ActionBar's 34rem threshold): in a card
// narrower than 34rem (phone, and the low end of md and lg, where the feed column is narrowest) the
// actions leave the top-right and become a row under the chips, so the text keeps the card's width.
const NARROW_GRID = "@max-[34rem]:grid-cols-[40px_minmax(0,1fr)]";

/**
 * Job card (§8.5 JobCard): meta first ("Job · Matches your position group"), title 15/600 linked,
 * "Program · City, ST · Conf · Full-time", chips (dashed Sample listing first), network proof, then
 * Save + View job top-right in a wide card, or a row under the chips in a narrow one (View job
 * flexing to fill; 44px on phone). Save shares the jobs feature's saved-jobs store, so a job saved
 * here shows as saved on /jobs. Apply lives on the job page only.
 */
export function JobCard({ job }: { job: FeedJob }) {
  const headingId = `fi-j-${job.id}`;
  const { org } = job;
  const reason = job.matchesPosition
    ? "Matches your position group"
    : job.atViewerProgram
      ? `${org.shortName} · your program`
      : job.inViewerConference
        ? `${org.conferenceAbbr} · your conference`
        : null;
  const place = org.city && org.state ? `${org.city}, ${org.state}` : (org.city ?? org.state);
  const sub = [org.shortName, place, org.conferenceAbbr, job.employmentType].filter(Boolean) as string[];
  const href = `/jobs/${job.id}`;
  return (
    <FeedArticle labelledBy={headingId}>
      <div className="@container">
        <div className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-x-3 p-4 ${NARROW_GRID}`}>
          <OrgMark shortName={org.shortName} name={org.name} size={40} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-fg-3">
              <span className="inline-flex items-center gap-1 font-medium text-fg-2">
                <Icon icon={Briefcase} size={12} />
                Job
              </span>
              {reason && (
                <>
                  <Sep />
                  <span>{reason}</span>
                </>
              )}
            </p>
            <h2 id={headingId} className="mt-0.5 text-subtitle font-semibold leading-5">
              <Link href={href} className="target-24 underline-offset-2 hover:underline">
                {job.title}
              </Link>
            </h2>
            <p className="mt-0.5 text-small text-fg-2">
              {/* Breaks fall after a "·", so a wrapped line never starts with one. */}
              {sub.map((s, i) => (
                <span key={i}>
                  {i > 0 && " "}
                  <span className={i > 0 ? "whitespace-nowrap" : undefined}>
                    {s === org.conferenceAbbr ? <abbr title={org.conference ?? s}>{s}</abbr> : s}
                    {i < sub.length - 1 && " ·"}
                  </span>
                </span>
              ))}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {job.isSample && <DemoLabel kind="listing" />}
              <Chip>{ROLE_GROUP_LABEL[job.roleGroup as RoleGroup] ?? "Staff"}</Chip>
              <LevelBadge level={org.level} />
            </div>
            {job.network && (
              <div className="mt-3 flex items-center gap-2 text-caption text-fg-2">
                <span className="flex shrink-0 gap-1">
                  {job.network.people.map((p) => (
                    <Avatar key={p.slug} name={p.fullName} tintKey={p.slug} size={24} />
                  ))}
                </span>
                <span className="min-w-0">{networkSentence(job.network)}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 @max-[34rem]:col-span-full @max-[34rem]:mt-3">
            <span className="@max-[34rem]:order-2">
              <SaveJobButton jobId={job.id} title={job.title} large />
            </span>
            <ButtonLink href={href} phone="large" className="@max-[34rem]:order-1 @max-[34rem]:flex-1" aria-label={`View job: ${job.title}`}>
              View job
            </ButtonLink>
          </div>
        </div>
      </div>
    </FeedArticle>
  );
}
