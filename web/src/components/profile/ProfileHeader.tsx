import Link from "next/link";
import { Info, MapPin, ShieldCheck } from "lucide-react";
import { LevelBadge, ConferenceBadge, DemoLabel } from "@/components/data/Badges";
import { InferredYear } from "@/components/data/InferredYear";
import { SourceLink } from "@/components/data/SourceLink";
import { StatGroup, type Stat } from "@/components/data/StatGroup";
import type { DemoAccountOption } from "@/components/shell/types";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import type { OrgSummary } from "@/lib/queries/people";
import { sourceDomain } from "@/lib/format";
import { stateName } from "./model";
import { ProfileActions, type ProfileViewer } from "./ProfileActions";
import type { ProfilePerson } from "./ProfileDialogs";

type ProfileHeaderProps = {
  person: ProfilePerson & { currentTitle: string | null; isDemo: boolean };
  currentOrg: OrgSummary | null;
  viewer: ProfileViewer;
  accounts: DemoAccountOption[];
  connection: "none" | "pending" | "accepted";
  stats: {
    seasons: number | null;
    stops: number;
    treeSize: number;
    first: { year: number; inferred: boolean; reason: string } | null;
  };
  /** Staff bio URLs the record was built from. */
  sources: string[];
  hasRoles: boolean;
};

function Missing() {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="sr-only">Not in source</span>
    </>
  );
}

/**
 * Profile header card (§8.4): avatar 80 · identity · actions, the stat band and, on unclaimed
 * profiles, the source banner. Owner view (coach demo on their own profile) opens with a strip
 * labelled Demo that says only they see the edit controls.
 */
export function ProfileHeader({ person, currentOrg, viewer, accounts, connection, stats, sources, hasRoles }: ProfileHeaderProps) {
  const first = person.firstName;
  const programHref = currentOrg?.inRegistry ? `/programs/${currentOrg.slug}` : null;
  const place = stateName(currentOrg?.state);
  const statList: Stat[] = [
    { label: "Seasons coached", value: stats.seasons ?? <Missing /> },
    { label: "Coaching stops", value: stats.stops },
    { label: "In coaching tree", value: stats.treeSize, href: stats.treeSize > 0 ? `/in/${person.slug}/tree` : undefined },
    {
      label: "First season",
      value: stats.first ? stats.first.inferred ? <InferredYear reason={stats.first.reason}>{stats.first.year}</InferredYear> : stats.first.year : <Missing />,
      hideOnPhone: true,
    },
  ];

  return (
    <Card aria-labelledby="profile-name" className="overflow-hidden px-4 pt-4 md:px-6 md:pt-6">
      {viewer === "owner" && (
        <div className="-mx-4 -mt-4 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-divider px-4 py-2 text-caption text-fg-2 md:-mx-6 md:-mt-6 md:mb-5 md:px-6">
          <SampleChip label="Demo" />
          <span className="font-semibold text-fg-1">Owner view</span>
          <span aria-hidden="true" className="max-md:hidden">
            ·
          </span>
          <span className="max-md:basis-full">Only you see these controls. Your public record stays Unclaimed until you claim it.</span>
        </div>
      )}

      <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-4 [grid-template-areas:'av_id'_'act_act'] md:grid-cols-[80px_minmax(0,1fr)] md:gap-x-5 md:[grid-template-areas:'av_id'_'av_act'] lg:grid-cols-[80px_minmax(0,1fr)_auto] lg:[grid-template-areas:'av_id_act']">
        <Avatar name={person.fullName} tintKey={person.slug} size={80} className="[grid-area:av] max-md:size-14 max-md:text-[20px]" />
        <div className="min-w-0 [grid-area:id] md:pt-0.5">
          <h1 id="profile-name" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-display max-md:gap-x-2 max-md:text-display-sm">
            <span className="min-w-0">{person.fullName}</span>
            {!person.claimed && (
              <Chip kind="outline" title={`Built from public sources. ${first} hasn't claimed this profile yet.`}>
                Unclaimed
              </Chip>
            )}
            {person.isDemo && <DemoLabel />}
          </h1>
          {(person.currentTitle || currentOrg) && (
            <p className="mt-0.5 text-body max-md:text-body md:text-subtitle">
              {person.currentTitle}
              {person.currentTitle && currentOrg && " at "}
              {currentOrg &&
                (programHref ? (
                  <Link href={programHref} className="target-24 font-medium underline-offset-2 hover:underline">
                    {currentOrg.name}
                  </Link>
                ) : (
                  <span className="font-medium">{currentOrg.name}</span>
                ))}
            </p>
          )}
          {(place || currentOrg?.level || currentOrg?.conferenceAbbr) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-small leading-5 text-fg-2 md:mt-2">
              {place && (
                <span className="mr-1 inline-flex items-center gap-1">
                  <Icon icon={MapPin} size={14} />
                  {place}
                </span>
              )}
              <LevelBadge level={currentOrg?.level} />
              <ConferenceBadge abbr={currentOrg?.conferenceAbbr} name={currentOrg?.conference} />
            </div>
          )}
        </div>
        <ProfileActions person={person} viewer={viewer} accounts={accounts} connection={connection} className="[grid-area:act] max-md:w-full" />
      </div>

      <StatGroup stats={statList} label="Career stats" className="mt-4 md:mt-5" />

      {!person.claimed && <SourceBanner person={person} sources={sources} hasRoles={hasRoles} owner={viewer === "owner"} />}
    </Card>
  );
}

/**
 * Source banner (§8.3): built from public sources, with a link to each staff bio, and "Is this
 * you? Claim profile". Neutral on purpose: unclaimed is normal. role="note".
 */
function SourceBanner({ person, sources, hasRoles, owner }: { person: ProfilePerson; sources: string[]; hasRoles: boolean; owner: boolean }) {
  const shown = sources.slice(0, 3);
  return (
    <div
      role="note"
      className="-mx-4 flex flex-wrap items-start gap-x-3 gap-y-2 border-t border-divider bg-surface-2 px-4 py-3 text-small leading-5 text-fg-2 md:-mx-6 md:flex-nowrap md:px-6"
    >
      <Icon icon={Info} size={16} className="mt-0.5 text-fg-2" />
      <p className="min-w-0 flex-1 basis-[calc(100%-28px)] md:basis-auto">
        {shown.length ? (
          <>
            Built from public sources:{" "}
            {shown.map((url, i) => (
              <span key={url}>
                {i > 0 && (i === shown.length - 1 ? " and the " : ", the ")}
                <SourceLink href={url} label={`${sourceDomain(url)} staff bio`} />
              </span>
            ))}
            .
          </>
        ) : (
          "Built from public sources."
        )}
        {hasRoles && " Each role below shows the sentence it came from."}
      </p>
      {!owner && (
        <div className="flex w-full items-center justify-between gap-2.5 pl-7 md:w-auto md:shrink-0 md:justify-start md:pl-0">
          <span>Is this you?</span>
          <ButtonLink href={`/claim/${person.slug}`} size="sm" icon={ShieldCheck} phone="large">
            Claim profile
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
