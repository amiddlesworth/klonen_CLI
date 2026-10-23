import { MapPin } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { StatGroup } from "@/components/data/StatGroup";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { ClaimSubject } from "@/lib/queries/claim";

/**
 * The profile header as it will look once claimed (§8.11 step 3): same identity, headline and
 * stats as the profile header card, without the Unclaimed chip or the public-sources banner.
 * Not interactive: it is a picture of the header, so nothing in it is a link.
 */
export function ProfilePreview({ subject }: { subject: ClaimSubject }) {
  const { person, currentOrg: org, stats } = subject;
  const location = org ? [org.city, org.state].filter(Boolean).join(", ") : "";
  return (
    <div aria-label={`Preview of ${person.fullName}'s profile header`} role="group">
      <div className="flex items-start gap-3 md:gap-4">
        <Avatar name={person.fullName} tintKey={person.slug} size={64} className="max-md:size-14 max-md:text-[20px]" />
        <div className="min-w-0 flex-1">
          <p className="text-display-sm md:text-display">{person.fullName}</p>
          {(person.currentTitle || org) && (
            <p className="mt-0.5 text-body md:text-subtitle">
              {person.currentTitle ?? "Coach"}
              {org && (
                <>
                  {" at "}
                  <span className="font-medium">{org.name}</span>
                </>
              )}
            </p>
          )}
          {org && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-2">
              {location && (
                <span className="inline-flex items-center gap-1">
                  <Icon icon={MapPin} size={14} />
                  {location}
                </span>
              )}
              <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} />
            </p>
          )}
        </div>
      </div>
      <StatGroup
        label="Career stats"
        className="mt-4"
        stats={[
          { value: stats.seasonsCoached ?? "–", label: "Seasons coached" },
          { value: stats.stops, label: stats.stops === 1 ? "Coaching stop" : "Coaching stops" },
          { value: stats.treeSize, label: "In coaching tree" },
          { value: stats.firstSeason ?? "–", label: "First season", hideOnPhone: true },
        ]}
      />
    </div>
  );
}
