import type { ReactNode } from "react";
import { Building2, Info } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { SourceLink } from "@/components/data/SourceLink";
import { StatGroup, type Stat } from "@/components/data/StatGroup";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { cn } from "@/lib/cn";
import type { ProgramOrg } from "@/lib/queries/program";
import { placeLine } from "./place";

type ProgramHeaderProps = {
  org: ProgramOrg;
  stats: Stat[];
  /** Follow + More (registry programs). */
  actions?: ReactNode;
  /** Page tabs as the last row of the card (registry programs). */
  tabs?: TabItem[];
  /** A --surface-2 band at the bottom of the card (light pages explain what they are). */
  note?: ReactNode;
  /** Personal reason from the session ("your program"): a ContextStrip band at the top of the card (§8.3). */
  context?: string;
};

/**
 * Program header card (§8.6): OrgMark 56 (48 inline on phone), name text-display (h1), "{Nickname} ·
 * Place" 15 --fg-2, division and conference chips with the athletics SourceLink, actions right
 * (under the identity at 721–1080, a full-width row on phone), StatBand, then the tabs flush with the
 * card's bottom edge.
 */
export function ProgramHeader({ org, stats, actions, tabs, note, context }: ProgramHeaderProps) {
  const sub = [org.nickname, placeLine(org.city, org.state)].filter(Boolean).join(" · ");
  return (
    <Card aria-labelledby="program-name" className={cn("px-4 pt-4 md:px-6 md:pt-6", note && !tabs && "overflow-hidden")}>
      {context && (
        <p className="-mx-4 -mt-4 mb-4 flex items-center gap-1.5 border-b border-divider px-4 py-2 text-caption text-fg-2 md:-mx-6 md:-mt-6 md:mb-5 md:px-6">
          <Icon icon={Building2} size={12} className="text-fg-2" />
          <span className="sr-only">Why you&apos;re seeing this: </span>
          <b className="min-w-0 truncate font-semibold text-fg-1">{org.shortName}</b>
          <span aria-hidden="true" className="text-fg-3">
            ·
          </span>
          <span className="min-w-0 truncate">{context}</span>
        </p>
      )}
      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 gap-y-4 md:grid-cols-[56px_minmax(0,1fr)] md:gap-x-5 lg:grid-cols-[56px_minmax(0,1fr)_auto]">
        <OrgMark shortName={org.shortName} name={org.name} size={56} className="max-md:size-12 max-md:rounded-[10px] max-md:text-[16px]" />
        <div className="min-w-0 md:pt-0.5">
          <h1 id="program-name" className="text-display-sm md:text-display">
            {org.name}
          </h1>
          {sub && <p className="mt-0.5 text-body text-fg-2 md:text-subtitle">{sub}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-small text-fg-2">
            <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} />
            {org.athleticsUrl && (
              <>
                {(org.level || org.conferenceAbbr) && (
                  <span aria-hidden="true" className="text-fg-3">
                    ·
                  </span>
                )}
                <SourceLink href={org.athleticsUrl} />
              </>
            )}
          </div>
        </div>
        {actions && <div className="col-span-2 flex gap-2 md:col-span-1 md:col-start-2 lg:col-start-3 lg:row-start-1">{actions}</div>}
      </div>

      <StatGroup stats={stats} label={`${org.shortName} at a glance`} className="mt-4 md:mt-5" />

      {note && (
        <div role="note" className="-mx-4 flex items-start gap-3 border-t border-divider bg-surface-2 px-4 py-3 text-small leading-5 text-fg-2 md:-mx-6 md:px-6">
          <Icon icon={Info} size={16} className="mt-0.5 text-fg-2" />
          <p className="min-w-0 flex-1">{note}</p>
        </div>
      )}

      {tabs && <Tabs items={tabs} label={`${org.shortName} sections`} className="-mx-4 border-b-0 border-t pb-px md:-mx-6 md:px-2" />}
    </Card>
  );
}
