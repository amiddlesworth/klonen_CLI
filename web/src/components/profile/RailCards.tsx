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
import { BRAND } from "@/lib/brand";
import { conferenceShort, sourceDomain, titleShort } from "@/lib/format";
import type { PersonSummary } from "@/lib/queries/people";
import type { ProgramCard, SameTreeLink } from "@/lib/queries/profile";
import { stateName, treeYearsView, type TreeYearsView } from "./model";
import { RowConnectButton } from "./ProfileActions";
import { InlineYears } from "./TreeYears";

/** Rail rows abbreviate titles sooner than tree rows (§6.3 titleShort), so the program fits beside them. */
const RAIL_TITLE_MAX = 28;

/**
 * The "Title · Program · Conf" line of a rail person row (§12: truncate the title, keep the context):
 * the title truncates on its own and the program part stays whole.
 */
function TitleOrg({ title, org }: { title: string | null; org: string | null }) {
  if (!title) return org ? <span className="block truncate">{org}</span> : null;
  return (
    <span className="flex min-w-0">
      <span className="min-w-0 truncate">{title}</span>
      {org && <span className="max-w-[75%] shrink-0 truncate">{`\u00a0·\u00a0${org}`}</span>}
    </span>
  );
}

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
          <TextLink href={href} arrow target24 className="text-small" aria-label={`View program: ${program.name}`}>
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
          <dd className="num font-semibold text-fg-1">
            {href && program.openJobs > 0 ? (
              <Link href={`${href}?tab=jobs`} className="target-24 underline-offset-2 hover:underline" aria-label={`${program.openJobs} open ${program.openJobs === 1 ? "job" : "jobs"} at ${program.shortName}`}>
                {program.openJobs}
              </Link>
            ) : (
              program.openJobs
            )}
          </dd>
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

/**
 * "Via Nic Brockhoff · both at George Fox, 2015–24": how a Same tree person connects. The years are
 * shown only when the source pins them, dotted when inferred.
 */
function ViaLine({ link: l }: { link: SameTreeLink }) {
  const view: TreeYearsView = treeYearsView(l.years, (id) => (id === l.person.id ? l.person.fullName : id === l.via.id ? l.via.fullName : undefined));
  const years =
    view.kind === "range" ? (
      <>
        , <InlineYears view={view} />
      </>
    ) : null;
  const first = l.person.fullName.split(" ")[0];
  return (
    <>
      Via {l.via.fullName} ·{" "}
      {l.relation === "alongside" ? (
        <>both at {l.orgShortName}</>
      ) : l.relation === "via_coached" ? (
        <>
          {first}&apos;s head coach at {l.orgShortName}
        </>
      ) : (
        <>
          coached under {first} at {l.orgShortName}
        </>
      )}
      {years}
    </>
  );
}

/** Whether a Same tree card shows an inferred year (the page explains the mark once). */
export function sameTreeInferred(links: SameTreeLink[]): boolean {
  return links.some((l) => treeYearsView(l.years, () => undefined).kind === "range" && l.years.inferred);
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
  explainInferred,
}: {
  links: SameTreeLink[];
  firstName: string;
  programShortName: string;
  signedIn: boolean;
  accounts: DemoAccountOption[];
  /** Explain the dotted year here (when nothing else on the page does). */
  explainInferred?: boolean;
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
                title={<TitleOrg title={p.currentTitle ? titleShort(p.currentTitle, RAIL_TITLE_MAX) : null} org={p.org?.shortName ?? null} />}
                context={
                  <ContextLine icon={Network}>
                    <ViaLine link={l} />
                  </ContextLine>
                }
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
      {explainInferred && sameTreeInferred(links) && <p className="mt-3 border-t border-divider pt-3 text-caption text-fg-3">Dotted years are inferred from a bio, not stated in it.</p>}
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
              title={
                <TitleOrg title={p.currentTitle ? titleShort(p.currentTitle, RAIL_TITLE_MAX) : null} org={[p.org?.shortName, conferenceShort(p.org?.conferenceAbbr)].filter(Boolean).join(" · ") || null} />
              }
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
