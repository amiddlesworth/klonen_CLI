import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { SectionCard } from "@/components/data/SectionCard";
import { ButtonLink } from "@/components/ui/Button";
import { SampleChip } from "@/components/ui/Chip";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import { cn } from "@/lib/cn";
import { placeLong, sourceDomain } from "@/lib/format";

export type CurrentProgramOrg = {
  slug: string;
  name: string;
  shortName: string;
  nickname: string | null;
  level: string | null;
  conference: string | null;
  conferenceAbbr: string | null;
  city: string | null;
  state: string | null;
  athleticsUrl: string | null;
  inRegistry: boolean;
};

/** The program page's own header counts (lib/queries/program getProgramCounts), so the numbers match it. */
export type CurrentProgramCounts = { staff: number; coached: number; jobs: number; sampleJobs: number };

/** The program page's words for a registry program whose staff page we couldn't read (a dash, not a zero). */
const STAFF_NOT_READ = "Staff not read yet";

function Row({ label, adornment, children }: { label: string; adornment?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-2 border-t border-divider py-2 text-small text-fg-2">
      {/* The dashed Sample chip sits right after the label it qualifies (§8.3 KPIStrip rule, audit X04). */}
      <dt className="flex min-w-0 items-center gap-1.5">
        {label}
        {adornment}
      </dt>
      <dd className="num font-semibold text-fg-1">{children}</dd>
    </div>
  );
}

type CurrentProgramCardProps = {
  org: CurrentProgramOrg;
  counts: CurrentProgramCounts;
  /** "Current program" on a profile; "Program" beside a job. Everything else is identical. */
  title?: string;
  /** Section id (and its heading id), unique on the page. */
  id?: string;
};

/**
 * Rail card for a program (§8.4 "Current program", §8.9 "Program card, as Current program"), the
 * one component the profile rail and the job rail share (audit X04): title + "View program →";
 * tile 40, name (linked), "{Nickname} · City, ST" (the state alone when no city is known), chips;
 * fixed key-value rows Staff listed · Alumni coaches · Open jobs with the program page's numbers
 * and labels (a dashed "Sample" after the Open jobs label when any of those jobs is a sample or
 * demo listing); then View staff and the athletics site.
 */
export function CurrentProgramCard({ org, counts, title = "Current program", id = "current-program" }: CurrentProgramCardProps) {
  const href = org.inRegistry ? `/programs/${org.slug}` : null;
  const sub = [org.nickname, placeLong(org.city, org.state)].filter(Boolean).join(" · ");
  // A registry program with no staff rows means its staff page wasn't read, not that it has no staff.
  const staffUnread = org.inRegistry && counts.staff === 0;
  const site = org.athleticsUrl;
  return (
    <SectionCard
      id={id}
      size="rail"
      title={title}
      action={
        href ? (
          <TextLink href={href} arrow target24 className="text-small" aria-label={`View program: ${org.name}`}>
            View program
          </TextLink>
        ) : undefined
      }
    >
      <div className="mt-2 flex items-start gap-3">
        <OrgMark shortName={org.shortName} name={org.name} size={40} />
        <div className="min-w-0">
          <p className="text-small font-semibold text-fg-1">
            {href ? (
              <Link href={href} className="target-24 underline-offset-2 hover:underline">
                {org.name}
              </Link>
            ) : (
              org.name
            )}
          </p>
          {sub && <p className="mt-0.5 text-caption text-fg-2">{sub}</p>}
          <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} className="mt-1.5" />
        </div>
      </div>
      <dl className="mt-3">
        {staffUnread ? (
          <Row label={STAFF_NOT_READ}>
            <span aria-hidden="true">–</span>
            <span className="sr-only">none listed</span>
          </Row>
        ) : (
          <Row label="Staff listed">{counts.staff}</Row>
        )}
        <Row label="Alumni coaches">{counts.coached}</Row>
        <Row label="Open jobs" adornment={counts.sampleJobs > 0 ? <SampleChip label="Sample" /> : undefined}>
          {href && counts.jobs > 0 ? (
            <Link
              href={`${href}?tab=jobs`}
              className="target-24 underline-offset-2 hover:underline"
              aria-label={`${counts.jobs} open ${counts.jobs === 1 ? "job" : "jobs"} at ${org.shortName}`}
            >
              {counts.jobs}
            </Link>
          ) : (
            counts.jobs
          )}
        </Row>
      </dl>
      {(href || site) && (
        <div className={cn("mt-1 grid gap-2", href && site ? "grid-cols-2" : "grid-cols-1")}>
          {href && (
            <ButtonLink href={`${href}?tab=staff`} size="sm" phone="large" className="min-w-0">
              View staff
            </ButtonLink>
          )}
          {site && (
            <ButtonLink href={site} size="sm" phone="large" iconRight={ExternalLink} className="min-w-0">
              <span className="truncate">{sourceDomain(site)}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </ButtonLink>
          )}
        </div>
      )}
    </SectionCard>
  );
}
