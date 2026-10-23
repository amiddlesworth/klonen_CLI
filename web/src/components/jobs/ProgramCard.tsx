import Link from "next/link";
import { ProgramBadges } from "@/components/data/Badges";
import { ExternalLink } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { sourceDomain } from "@/lib/format";
import type { JobOrg } from "@/lib/queries/jobsx";

/**
 * Rail card for the hiring program (§8.9 "Program card, as Current program", §8.4): tile 40,
 * name linked to the program page, "{Nickname} · ST", chips, key-value rows, and two small
 * secondary buttons (View staff · athletics site).
 */
export function ProgramCard({ org, staffCount, openJobs }: { org: JobOrg; staffCount: number; openJobs: number }) {
  const programHref = org.inRegistry ? `/programs/${org.slug}` : null;
  const sub = [org.nickname, [org.city, org.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  return (
    <Card padding="rail" aria-labelledby="job-program-title">
      <CardHeader
        id="job-program-title"
        size="rail"
        title="Program"
        action={
          programHref ? (
            <TextLink href={programHref} arrow className="text-small">
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
        <div className="flex items-baseline justify-between gap-2 border-t border-divider py-2 text-small text-fg-2">
          <dt>Staff on {BRAND.name}</dt>
          <dd className="num font-semibold text-fg-1">{staffCount}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-divider py-2 text-small text-fg-2">
          <dt>Open jobs</dt>
          <dd className="num font-semibold text-fg-1">{openJobs}</dd>
        </div>
      </dl>
      {(programHref || org.athleticsUrl) && (
        <div className="mt-1 grid grid-cols-2 gap-2">
          {programHref && (
            <ButtonLink href={`${programHref}?tab=staff`} size="sm" phone="large" className="min-w-0">
              View staff
            </ButtonLink>
          )}
          {org.athleticsUrl && (
            <a href={org.athleticsUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonClasses({ size: "sm", phone: "large" }), "min-w-0 gap-1")}>
              <span className="truncate">{sourceDomain(org.athleticsUrl)}</span>
              <Icon icon={ExternalLink} size={12} />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
