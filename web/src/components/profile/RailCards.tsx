import Link from "next/link";
import { ChevronRight, ExternalLink, Network } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { ContextLine } from "@/components/data/ContextLine";
import { PersonRow } from "@/components/data/PersonRow";
import { SectionCard } from "@/components/data/SectionCard";
import type { DemoAccountOption } from "@/components/shell/types";
import { ButtonLink } from "@/components/ui/Button";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import { BRAND, CURRENT_SEASON } from "@/lib/brand";
import { conferenceShort, seasonRangeCompact, sourceDomain, titleShort } from "@/lib/format";
import type { PersonSummary } from "@/lib/queries/people";
import type { ProgramCard, SameTreeLink } from "@/lib/queries/profile";
import { stateName } from "./model";
import { RowConnectButton } from "./ProfileActions";

/** Rail: Current program (§8.4): the program, staff on the network, open jobs, View staff and the athletics site. */
export function CurrentProgramCard({ program }: { program: ProgramCard }) {
  const href = program.inRegistry ? `/programs/${program.slug}` : null;
  const sub = [program.nickname, stateName(program.state)].filter(Boolean).join(" · ");
  return (
    <SectionCard
      id="current-program"
      size="rail"
      title="Current program"
      action={
        href ? (
          <TextLink href={href} arrow className="text-small" aria-label={`View program: ${program.name}`}>
            View program
          </TextLink>
        ) : undefined
      }
    >
      <div className="mt-3 flex gap-3">
        <OrgMark shortName={program.shortName} name={program.name} size={40} />
        <div className="min-w-0">
          <p className="text-small font-semibold">
            {href ? (
              <Link href={href} className="target-24 underline-offset-2 hover:underline">
                {program.name}
              </Link>
            ) : (
              program.name
            )}
          </p>
          {sub && <p className="mt-0.5 text-caption text-fg-2">{sub}</p>}
          <ProgramBadges level={program.level} conferenceAbbr={program.conferenceAbbr} conference={program.conference} className="mt-1.5" />
        </div>
      </div>
      <dl className="mt-3">
        <div className="flex items-baseline justify-between gap-2 border-t border-divider py-2 text-small text-fg-2">
          <dt>Staff on {BRAND.name}</dt>
          <dd className="num font-semibold text-fg-1">{program.staffCount}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-divider py-2 text-small text-fg-2">
          <dt className="flex items-center gap-1.5">
            Open jobs
            {program.sampleJobs > 0 && <SampleChip label="Sample" />}
          </dt>
          <dd className="num font-semibold text-fg-1">{program.openJobs}</dd>
        </div>
      </dl>
      {(href || program.athleticsUrl) && (
        <div className="mt-1 flex gap-2">
          {href && (
            <ButtonLink href={`${href}?tab=staff`} size="sm" className="flex-auto">
              View staff
            </ButtonLink>
          )}
          {program.athleticsUrl && (
            <ButtonLink href={program.athleticsUrl} size="sm" iconRight={ExternalLink} className="min-w-0 flex-auto">
              <span className="truncate">{sourceDomain(program.athleticsUrl)}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </ButtonLink>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** "Via Rob Hutchins · Chris's head coach at Colorado, 1989–90": how a Same tree person connects. */
function viaLine(l: SameTreeLink): string {
  const ongoing = !!l.endYear && l.endYear >= CURRENT_SEASON;
  const years = l.startYear ? `, ${seasonRangeCompact(l.startYear, ongoing ? null : l.endYear, ongoing)}` : "";
  const first = l.person.fullName.split(" ")[0];
  const how =
    l.relation === "alongside"
      ? `both at ${l.orgShortName}${years}`
      : l.relation === "via_coached"
        ? `${first}'s head coach at ${l.orgShortName}${years}`
        : `coached under ${first} at ${l.orgShortName}${years}`;
  return `Via ${l.via.fullName} · ${how}`;
}

/**
 * Rail: Same tree (§8.4): two steps from the coach, through the current staff, excluding anyone in
 * the tree card. Hidden when empty.
 */
export function SameTreeCard({
  links,
  firstName,
  programShortName,
  signedIn,
  accounts,
}: {
  links: SameTreeLink[];
  firstName: string;
  programShortName: string;
  signedIn: boolean;
  accounts: DemoAccountOption[];
}) {
  if (!links.length) return null;
  return (
    <SectionCard id="same-tree" size="rail" title="Same tree" subtitle={`Two steps from ${firstName}, through the ${programShortName} staff`}>
      <ul className="mt-1">
        {links.map((l) => {
          const p = l.person;
          return (
            <li key={p.id} className="border-t border-divider py-3 first:border-t-0 last:pb-0">
              <PersonRow
                name={p.fullName}
                href={`/in/${p.slug}`}
                tintKey={p.slug}
                avatarSize={36}
                size="sm"
                title={p.currentTitle ? titleShort(p.currentTitle) : null}
                org={p.org?.shortName}
                context={<ContextLine icon={Network}>{viaLine(l)}</ContextLine>}
                action={
                  <RowConnectButton
                    person={{ id: p.id, slug: p.slug, fullName: p.fullName, firstName: p.fullName.split(" ")[0], claimed: p.claimed }}
                    signedIn={signedIn}
                    accounts={accounts}
                  />
                }
              />
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

/**
 * Rail: People also viewed (§8.4): head coaches in the same conference (there is no view data yet,
 * so the subtitle says what the list is). Whole row is the link. Dropped on phone.
 */
export function AlsoViewedCard({ people, conferenceAbbr }: { people: PersonSummary[]; conferenceAbbr: string }) {
  if (!people.length) return null;
  const conf = conferenceShort(conferenceAbbr) ?? conferenceAbbr;
  return (
    <SectionCard id="also-viewed" size="rail" title="People also viewed" subtitle={`Head coaches in the ${conf}`} className="max-md:hidden">
      <ul className="mt-1">
        {people.map((p) => (
          <li key={p.id} className="border-t border-divider py-2 first:border-t-0 last:pb-0">
            <PersonRow
              name={p.fullName}
              href={`/in/${p.slug}`}
              tintKey={p.slug}
              avatarSize={32}
              size="sm"
              linkRow
              title={p.currentTitle ? titleShort(p.currentTitle) : null}
              org={[p.org?.shortName, conferenceShort(p.org?.conferenceAbbr)].filter(Boolean).join(" · ")}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/** Breadcrumb (§8.4, md and up): "{Program} › Staff › {Name}". */
export function ProfileBreadcrumb({ name, program }: { name: string; program: { slug: string; shortName: string; inRegistry: boolean } | null }) {
  const sep = <Icon icon={ChevronRight} size={14} className="text-fg-3" />;
  const link = "inline-flex min-h-6 items-center rounded-xs underline-offset-2 hover:text-fg-1 hover:underline";
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1 text-small leading-6 text-fg-2">
        {program?.inRegistry ? (
          <>
            <li className="flex items-center gap-1">
              <Link href={`/programs/${program.slug}`} className={link}>
                {program.shortName}
              </Link>
              {sep}
            </li>
            <li className="flex items-center gap-1">
              <Link href={`/programs/${program.slug}?tab=staff`} className={link}>
                Staff
              </Link>
              {sep}
            </li>
          </>
        ) : (
          <li className="flex items-center gap-1">
            <Link href="/search?type=people" className={link}>
              Coaches
            </Link>
            {sep}
          </li>
        )}
        <li className="min-w-0 truncate">
          <span aria-current="page" className="text-fg-1">
            {name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
