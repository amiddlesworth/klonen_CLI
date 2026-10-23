import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { SeasonStrip, type StripStint } from "@/components/data/SeasonStrip";
import { SectionCard } from "@/components/data/SectionCard";
import { SourceDisclosure } from "@/components/data/SourceDisclosure";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import { cn } from "@/lib/cn";
import type { OrgSummary } from "@/lib/queries/people";
import { ExperienceList } from "./ExperienceList";
import { LedgerRange } from "./LedgerRange";
import { levelLine, stateName, type LedgerGroup, type LedgerItem } from "./model";

type ExperienceCardProps = {
  groups: LedgerGroup[];
  strip: StripStint[];
  seasons: number;
  /** Coaching roles with no start year, whose seasons the count leaves out ("34+ seasons"). */
  undatedRoles: number;
  personName: string;
  firstName: string;
  slug: string;
  owner: boolean;
  /** Whether an inferred year appears anywhere on the page (the legend explains the mark once). */
  showInferredKey: boolean;
  /** Roles in other sports: listed here, left out of the season and stop counts (the card says so). */
  otherSportRoles?: number;
  /** Unclassified football staff roles with no coaching title ("Faculty Liaison"): listed, not counted. */
  staffOnlyRoles?: number;
  /** A fictional demo candidate: its stints have no source, so each says so instead of a Source disclosure. */
  isDemo?: boolean;
};

/** Long careers start with the newest programs and a "Show all {n} programs" button (§8.1 ShowMore). */
const SHOW_FIRST = 6;
const TRUNCATE_OVER = 8;

/**
 * "34 seasons", or "34+ seasons" when some roles have no start year, so the count never reads as the
 * whole career (the header stat uses the same words).
 */
export function seasonsText(seasons: number, undatedRoles: number): string {
  return `${seasons}${undatedRoles > 0 ? "+" : ""} ${seasons === 1 && !undatedRoles ? "season" : "seasons"}`;
}

/**
 * "Seasons and coaching stops count football coaching only: 5 roles in other sports and 1 non-coaching
 * role are listed but not counted."
 */
function uncountedNote(otherSport: number, staffOnly: number): string {
  const parts = [
    otherSport > 0 && `${otherSport} ${otherSport === 1 ? "role" : "roles"} in other sports`,
    staffOnly > 0 && `${staffOnly} non-coaching ${staffOnly === 1 ? "role" : "roles"}`,
  ].filter(Boolean);
  const verb = otherSport + staffOnly === 1 ? "is" : "are";
  return `Seasons and coaching stops count football coaching only: ${parts.join(" and ")} ${verb} listed but not counted.`;
}

/** Program name, linked when the program has a page. */
export function OrgName({ org }: { org: Pick<OrgSummary, "slug" | "name" | "inRegistry"> }) {
  return org.inRegistry ? (
    <Link href={`/programs/${org.slug}`} className="target-24 underline-offset-2 hover:underline">
      {org.name}
    </Link>
  ) : (
    <span>{org.name}</span>
  );
}

/**
 * Experience (§8.4): season strip, then one group per program, newest first. The program always
 * leads (tile, name, chips, total range); role rows sit on a dot rail and carry their own range
 * only when the program has two or more roles. Every role has a Source disclosure.
 */
export function ExperienceCard({
  groups,
  strip,
  seasons,
  undatedRoles,
  personName,
  firstName,
  slug,
  owner,
  showInferredKey,
  otherSportRoles = 0,
  staffOnlyRoles = 0,
  isDemo = false,
}: ExperienceCardProps) {
  const claimLink = owner ? (
    <TextLink href={`/claim/${slug}`} arrow target24 className="text-small">
      Claim to edit
    </TextLink>
  ) : undefined;

  if (!groups.length) {
    return (
      <SectionCard
        id="experience"
        title="Experience"
        action={claimLink}
        empty={{
          icon: BriefcaseBusiness,
          title: "No coaching history in the source.",
          description: `${owner ? "You" : firstName} can add a coaching career after claiming the profile.`,
        }}
      />
    );
  }

  const items = groups.flatMap((g) => g.items);
  const roles = items.filter((i): i is Extract<LedgerItem, { kind: "role" }> => i.kind === "role");
  const hasCurrent = roles.some((r) => r.role.isCurrent);
  const hasPast = roles.some((r) => !r.role.isCurrent);
  const hasAway = items.some((i) => i.kind === "away");
  const meta = [`${groups.length} ${groups.length === 1 ? "program" : "programs"}`, seasons > 0 && seasonsText(seasons, undatedRoles)].filter(Boolean).join(" · ");
  const item = (g: LedgerGroup) => ({ key: g.org.id, node: <ExperienceGroup group={g} personName={personName} isDemo={isDemo} /> });

  return (
    // The owner's "Claim to edit" sits in the legend row, so the title row keeps one right-aligned item at every width.
    <SectionCard id="experience" title="Experience" meta={meta}>
      {/* overflow-x-clip: a phone strip label that runs past the last column ("Southwestern") can't widen
          the page (§11.12). clip, not hidden: no scroll container, vertical overflow untouched. */}
      <div className="overflow-x-clip">
        <SeasonStrip stints={strip} widthHint={760} />
      </div>
      <ExperienceList
        dated={groups.filter((g) => g.dated).map(item)}
        undated={groups.filter((g) => !g.dated).map(item)}
        personName={personName}
        limit={groups.length > TRUNCATE_OVER ? SHOW_FIRST : groups.length}
      />
      {((seasons > 0 && undatedRoles > 0) || otherSportRoles + staffOnlyRoles > 0) && (
        <p className="border-t border-divider py-3 text-caption text-fg-3">
          {seasons > 0 && undatedRoles > 0 && (
            <>
              {seasonsText(seasons, undatedRoles)}: {undatedRoles} {undatedRoles === 1 ? "role has" : "roles have"} no start year in the source, so{" "}
              {undatedRoles === 1 ? "its seasons aren't" : "their seasons aren't"} counted.
            </>
          )}
          {seasons > 0 && undatedRoles > 0 && otherSportRoles + staffOnlyRoles > 0 && " "}
          {otherSportRoles + staffOnlyRoles > 0 && uncountedNote(otherSportRoles, staffOnlyRoles)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-divider pt-3 text-caption text-fg-3">
        {hasCurrent && (
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="size-2 rounded-full bg-fg-1" />
            Current role
          </span>
        )}
        {hasPast && (
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="size-2 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--control)]" />
            Past role
          </span>
        )}
        {hasAway && (
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="mx-[3px] h-3 w-px border-l border-dashed border-control" />
            Time away
          </span>
        )}
        {showInferredKey && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inf num cursor-default">
              2004
            </span>
            Year inferred from the bio, not stated in it
          </span>
        )}
        {claimLink && <span className="ml-auto">{claimLink}</span>}
      </div>
    </SectionCard>
  );
}

/** One program group's content; ExperienceList wraps it in its list item. */
function ExperienceGroup({ group, personName, isDemo }: { group: LedgerGroup; personName: string; isDemo: boolean }) {
  const { org } = group;
  const multi = group.roleCount > 1;
  const place = stateName(org.state);
  // An undated group sits under the "Years not in source · order unknown" heading: its ranges would only
  // say that again (on the group and on every role).
  const showRange = (text: LedgerGroup["range"]) => group.dated || !text.undated;
  return (
    <>
      <OrgMark shortName={org.shortName} name={org.name} size={40} />
      <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body font-semibold">
            <OrgName org={org} />
            <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} />
          </h3>
          {place && <p className="mt-0.5 text-small text-fg-2">{place}</p>}
        </div>
        {showRange(group.range) && <LedgerRange text={group.range} inferred={group.inferred} reason={group.reason} className="md:max-w-[60%]" />}
      </div>
      <ol className="col-span-full mt-2">
        {group.items.map((item, i) => {
          const last = i === group.items.length - 1;
          if (item.kind === "away") {
            return (
              <li
                key={`away-${i}`}
                className="relative py-0.5 pl-[52px] text-caption text-fg-3 before:absolute before:-bottom-2 before:-top-0.5 before:left-[19.5px] before:border-l before:border-dashed before:border-control"
              >
                {item.text}
              </li>
            );
          }
          const { role } = item;
          const rowRange = multi && showRange(item.range);
          return (
            <li key={role.id} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 py-2 md:grid-cols-[40px_minmax(0,1fr)_128px]">
              <span
                aria-hidden="true"
                className={cn("absolute left-4 top-3.5 size-2 rounded-full", role.isCurrent ? "bg-fg-1" : "bg-surface shadow-[inset_0_0_0_1.5px_var(--control)]")}
              />
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn("absolute -bottom-2.5 left-[19.5px] top-[26px] border-l", item.awayAfter ? "border-dashed border-control" : "border-border-strong")}
                />
              )}
              <p className="col-start-2 row-start-1 text-body font-medium">
                {role.role}
                {role.isCurrent && <span className="sr-only"> (current role)</span>}
              </p>
              {rowRange && (
                <LedgerRange
                  text={item.range}
                  inferred={item.inferred}
                  reason={item.reason}
                  // justify-self-end: a count wider than the 128px column ("Start year not in source") grows
                  // into the gap on its left instead of past the card edge.
                  className="col-start-2 row-start-2 md:col-start-3 md:row-span-2 md:row-start-1 md:justify-self-end"
                />
              )}
              <p className={cn("col-start-2 text-small text-fg-2", rowRange ? "row-start-3 md:row-start-2" : "row-start-2")}>{levelLine(role)}</p>
              {isDemo ? (
                // A demo stint has no source: say so plainly (no quote marks, nothing styled as evidence).
                <p className={cn("col-start-2 mt-0.5 text-caption text-fg-3", rowRange ? "row-start-4 md:row-start-3" : "row-start-3")}>
                  Demo record, not from a source
                </p>
              ) : (
                <SourceDisclosure
                  evidence={role.evidence}
                  sourceUrl={role.sourceUrl}
                  sourceDetail={`${personName} bio`}
                  className={cn("col-start-2 mt-0.5", rowRange ? "row-start-4 md:row-start-3" : "row-start-3")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
