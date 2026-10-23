import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import { cn } from "@/lib/cn";
import { sourceDomain } from "@/lib/format";
import type { JobOrg, ProgramCounts } from "@/lib/queries/jobsx";

/**
 * The program page's words for a registry program whose staff page we couldn't read (a dash, not a
 * zero: no rows means unread, not "no staff"). Same label there and here (§11 rule 11).
 */
const STAFF_NOT_READ = "Staff not read yet";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-divider py-2 text-small text-fg-2">
      <dt>{label}</dt>
      <dd className="num font-semibold text-fg-1">{children}</dd>
    </div>
  );
}

/**
 * Rail card for the hiring program (§8.9 "Program card, as Current program", §8.4): tile 40, name
 * linked to the program page, "{Nickname} · ST", chips, key-value rows with the program page's own
 * labels and numbers (Staff listed · Alumni coaches · Open jobs, with the dashed Sample chip when
 * every open job is a sample), and up to two small secondary buttons: the program's people (staff,
 * or its alumni coaches when no staff is listed) and the athletics site. A lone button spans both columns.
 */
export function ProgramCard({ org, counts }: { org: JobOrg; counts: ProgramCounts }) {
  const programHref = org.inRegistry ? `/programs/${org.slug}` : null;
  const sub = [org.nickname, [org.city, org.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const staffRead = counts.staff > 0;
  const peopleButton = programHref
    ? staffRead
      ? { href: `${programHref}?tab=staff`, label: "View staff" }
      : counts.coached > 0
        ? { href: `${programHref}?tab=alumni`, label: "View alumni" }
        : null
    : null;
  const site = org.athleticsUrl;

  return (
    <Card padding="rail" aria-labelledby="job-program-title">
      <CardHeader
        id="job-program-title"
        size="rail"
        title="Program"
        action={
          programHref ? (
            <TextLink href={programHref} arrow target24 className="text-small">
              View program
            </TextLink>
          ) : undefined
        }
      />
      <div className="mt-2 flex items-start gap-3">
        <OrgMark shortName={org.shortName} name={org.name} size={40} />
        <div className="min-w-0">
          <p className="text-small font-semibold text-fg-1">
            {programHref ? (
              <Link href={programHref} className="target-24 underline-offset-2 hover:underline">
                {org.name}
              </Link>
            ) : (
              org.name
            )}
          </p>
          {sub && <p className="text-caption text-fg-2">{sub}</p>}
          <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} className="mt-1.5" />
        </div>
      </div>
      <dl className="mt-3">
        {staffRead ? (
          <Row label="Staff listed">{counts.staff}</Row>
        ) : (
          <Row label={STAFF_NOT_READ}>
            <span aria-hidden="true">–</span>
            <span className="sr-only">none listed</span>
          </Row>
        )}
        <Row label="Alumni coaches">{counts.coached}</Row>
        <Row label="Open jobs">
          {counts.jobs > 0 && counts.sampleJobs === counts.jobs ? (
            <span className="inline-flex items-center gap-2">
              {counts.jobs}
              <SampleChip label="Sample" />
            </span>
          ) : (
            counts.jobs
          )}
        </Row>
      </dl>
      {(peopleButton || site) && (
        <div className={cn("mt-1 grid gap-2", peopleButton && site ? "grid-cols-2" : "grid-cols-1")}>
          {peopleButton && (
            <ButtonLink href={peopleButton.href} size="sm" phone="large" className="min-w-0">
              {peopleButton.label}
            </ButtonLink>
          )}
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer" className={cn(buttonClasses({ size: "sm", phone: "large" }), "min-w-0 gap-1")}>
              <span className="truncate">{sourceDomain(site)}</span>
              <Icon icon={ExternalLink} size={12} />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
