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
import { LedgerRange } from "./LedgerRange";
import { levelLine, stateName, type LedgerGroup, type LedgerItem } from "./model";

type ExperienceCardProps = {
  groups: LedgerGroup[];
  strip: StripStint[];
  seasons: number;
  personName: string;
  firstName: string;
  slug: string;
  owner: boolean;
  /** Whether an inferred year appears anywhere on the page (the legend explains the mark once). */
  showInferredKey: boolean;
};

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
export function ExperienceCard({ groups, strip, seasons, personName, firstName, slug, owner, showInferredKey }: ExperienceCardProps) {
  const action = owner ? (
    <TextLink href={`/claim/${slug}`} arrow className="text-small">
      Claim to edit
    </TextLink>
  ) : undefined;

  if (!groups.length) {
    return (
      <SectionCard
        id="experience"
        title="Experience"
        action={action}
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
  const meta = [`${groups.length} ${groups.length === 1 ? "program" : "programs"}`, seasons > 0 && `${seasons} ${seasons === 1 ? "season" : "seasons"}`].filter(Boolean).join(" · ");

  return (
    <SectionCard id="experience" title="Experience" meta={meta} action={action}>
      <SeasonStrip stints={strip} widthHint={760} />
      <ol aria-label={`${personName}'s coaching career, newest first`}>
        {groups.map((g) => (
          <ExperienceGroup key={g.org.id} group={g} personName={personName} />
        ))}
      </ol>
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
      </div>
    </SectionCard>
  );
}

function ExperienceGroup({ group, personName }: { group: LedgerGroup; personName: string }) {
  const { org } = group;
  const multi = group.roleCount > 1;
  const place = stateName(org.state);
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 border-t border-divider py-4 first:border-t-0">
      <OrgMark shortName={org.shortName} name={org.name} size={40} />
      <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body font-semibold">
            <OrgName org={org} />
            <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} />
          </h3>
          {place && <p className="mt-0.5 text-small text-fg-2">{place}</p>}
        </div>
        <LedgerRange text={group.range} inferred={group.inferred} reason={group.reason} />
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
              {multi && (
                <LedgerRange
                  text={item.range}
                  inferred={item.inferred}
                  reason={item.reason}
                  className="col-start-2 row-start-2 md:col-start-3 md:row-span-2 md:row-start-1"
                />
              )}
              <p className={cn("col-start-2 text-small text-fg-2", multi ? "row-start-3 md:row-start-2" : "row-start-2")}>{levelLine(role)}</p>
              <SourceDisclosure
                evidence={role.evidence}
                sourceUrl={role.sourceUrl}
                sourceDetail={`${personName} bio`}
                className={cn("col-start-2 mt-0.5", multi ? "row-start-4 md:row-start-3" : "row-start-3")}
              />
            </li>
          );
        })}
      </ol>
    </li>
  );
}
