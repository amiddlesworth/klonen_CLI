import type { CSSProperties, ReactNode } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { ConferenceBadge, DemoLabel, LevelBadge } from "@/components/data/Badges";
import { InferredYear } from "@/components/data/InferredYear";
import { stateName } from "@/components/profile/model";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { ClaimSubject } from "@/lib/queries/claim";

/** A value the source doesn't give: a dash for the eye, "Not in source" for screen readers (as ProfileHeader). */
function Missing() {
  return (
    <>
      <span aria-hidden="true">–</span>
      <span className="sr-only">Not in source</span>
    </>
  );
}

type PreviewStat = { label: string; value: ReactNode; linked?: boolean; hideOnPhone?: boolean };

/**
 * The profile header as it will look once claimed (§8.11 step 3). Same grid, words and numbers as
 * ProfileHeader (avatar 80, 56 on phone; the headline from currentHeadline(); state spelled out with
 * stateName(); "N+" seasons when some roles have no years; the stat band with the tree stat in --link
 * and a chevron), without the Unclaimed chip, the actions or the source banner. A demo person keeps
 * the Demo chip, as on the profile. Not interactive: it is a picture of the header, so the linked
 * stat is a span, not a link.
 */
export function ProfilePreview({ subject }: { subject: ClaimSubject }) {
  const { person, currentOrg: org, stats } = subject;
  const place = stateName(org?.state);
  const first = stats.firstSeason;
  const statList: PreviewStat[] = [
    {
      label: "Seasons coached",
      value: stats.seasonsCoached ? (
        stats.seasonsPlus ? (
          <>
            {stats.seasonsCoached}
            <span aria-hidden="true">+</span>
            <span className="sr-only"> or more (some roles have no years in the source)</span>
          </>
        ) : (
          stats.seasonsCoached
        )
      ) : (
        <Missing />
      ),
    },
    { label: stats.stops === 1 ? "Coaching stop" : "Coaching stops", value: stats.stops },
    { label: "In coaching tree", value: stats.treeSize, linked: stats.treeSize > 0 },
    {
      label: "First season",
      value: first ? first.inferred ? <InferredYear reason={first.reason}>{first.year}</InferredYear> : first.year : <Missing />,
      hideOnPhone: true,
    },
  ];
  const nPhone = statList.filter((s) => !s.hideOnPhone).length;

  return (
    <div aria-label={`Preview of ${person.fullName}'s profile header`} role="group">
      <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 md:grid-cols-[80px_minmax(0,1fr)] md:gap-x-5">
        <Avatar name={person.fullName} tintKey={person.slug} size={80} className="max-md:size-14 max-md:text-[20px]" />
        <div className="min-w-0 md:pt-0.5">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-display max-md:gap-x-2 max-md:text-display-sm">
            <span className="min-w-0">{person.fullName}</span>
            {person.isDemo && <DemoLabel />}
          </p>
          {(person.headline || org) && (
            <p className="mt-0.5 text-body md:text-subtitle">
              {person.headline}
              {person.headline && org && " at "}
              {org && <span className="font-medium">{org.name}</span>}
            </p>
          )}
          {(place || org?.level || org?.conferenceAbbr) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-small leading-5 text-fg-2 md:mt-2">
              {place && (
                <span className="mr-1 inline-flex items-center gap-1">
                  <Icon icon={MapPin} size={14} />
                  {place}
                </span>
              )}
              <LevelBadge level={org?.level} />
              <ConferenceBadge abbr={org?.conferenceAbbr} name={org?.conference} />
            </div>
          )}
        </div>
      </div>

      {/* StatGroup's header band, drawn with spans so the linked tree stat isn't a live link. */}
      <div
        role="group"
        aria-label="Career stats"
        style={{ "--n": statList.length, "--np": nPhone } as CSSProperties}
        className="mt-4 grid grid-cols-[repeat(var(--n),minmax(0,1fr))] border-t border-divider max-md:grid-cols-[repeat(var(--np),minmax(0,1fr))] md:mt-5"
      >
        {statList.map((s) => (
          <div
            key={s.label}
            className={cn(
              "flex min-w-0 flex-col py-3.5 pr-4 max-md:py-3 max-md:pr-1 [&+&]:border-l [&+&]:border-divider [&+&]:pl-5 max-md:[&+&]:pl-2.5",
              s.hideOnPhone && "max-md:hidden",
            )}
          >
            <span className="order-2 flex flex-wrap items-center gap-1 text-caption">
              <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap", s.linked ? "font-medium text-link" : "text-fg-2")}>
                {s.label}
                {s.linked && <Icon icon={ChevronRight} size={12} />}
              </span>
            </span>
            <span className="num order-1 text-stat max-md:text-stat-sm">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
