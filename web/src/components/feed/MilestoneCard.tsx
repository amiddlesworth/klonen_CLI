import Link from "next/link";
import { Flag } from "lucide-react";
import { InferredFootnote } from "@/components/data/InferredYear";
import { StatGroup, type Stat } from "@/components/data/StatGroup";
import { Avatar } from "@/components/ui/Avatar";
import type { FeedMilestone, FeedReason } from "@/lib/queries/feedx";
import { ActionBar } from "./ActionBar";
import { FeedArticle } from "./FeedArticle";
import { ContextStrip, ItemHeader, ItemMeta } from "./ItemParts";
import { ItemMenu } from "./ItemMenu";
import { OrgName, type FeedViewerLite } from "./MoveCard";
import { orgOf, pastRole, StintYears } from "./Sentences";
import { apTitle, atOrg, firstNameOf, ordinal, possessiveEnding } from "./text";

type MilestoneCardProps = {
  milestone: FeedMilestone;
  reason: FeedReason | null;
  viewer: FeedViewerLite;
  /** Explain the dotted underline here (the first item on the page that shows an inferred year). */
  showInferredNote?: boolean;
  /** The first item of its kind on the page: it holds the placeholder when the viewer hides milestones. */
  firstOfKind?: boolean;
};

/** True when the card shows an inferred year (the stop before the run, in the facts line). */
export function milestoneInferred(ms: FeedMilestone): boolean {
  return !ms.firstRole && !!ms.before && ms.before.inferred && ms.before.startYear !== null;
}

/**
 * Milestone (§8.5 FeedItem, design/reference/feed.html item 7): avatar 40, "{Name}’s 42nd season on
 * the {Org} staff" (no pronouns: the source rarely gives one), meta "Milestone · conf · 2026 season ·
 * source", then a StatBand of sourced facts with no box (seasons at the program, first season, other
 * stops or roles), one facts line, and the person action set. Every number comes from stints whose
 * years the source states (see staffRun).
 */
export function MilestoneCard({ milestone: ms, reason, viewer, showInferredNote, firstOfKind }: MilestoneCardProps) {
  const headingId = `fi-${ms.key}`;
  const { person, org } = ms;
  const first = firstNameOf(person.fullName, person.firstName);
  const personHref = `/in/${person.slug}`;

  const stats: Stat[] = [
    { value: ms.seasons, label: `Seasons at ${org.shortName}` },
    { value: ms.firstSeason, label: "First season" },
  ];
  if (ms.otherStops > 0) stats.push({ value: ms.otherStops, label: ms.otherStops === 1 ? "Other coaching stop" : "Other coaching stops" });
  else if (ms.roles > 1) stats.push({ value: ms.roles, label: `Roles at ${org.shortName}` });

  const before = ms.before;
  return (
    <FeedArticle labelledBy={headingId} hideKind="milestone" firstOfKind={firstOfKind} note={showInferredNote ? <InferredFootnote /> : undefined}>
      {reason && <ContextStrip reason={reason} />}
      <div className="px-4 pt-4">
        <ItemHeader
          media={<Avatar name={person.fullName} tintKey={person.slug} size={40} />}
          headingId={headingId}
          headline={
            <>
              <Link href={personHref}>{person.fullName}</Link>
              {possessiveEnding(person.fullName)} {ordinal(ms.seasons)} season on the <OrgName org={org} /> staff
            </>
          }
          meta={<ItemMeta icon={Flag} kind="Milestone" conferenceAbbr={org.conferenceAbbr} conference={org.conference} sourceUrl={ms.sourceUrl} />}
          menu={<ItemMenu subject={person.fullName} copyPath={personHref} sourceUrl={ms.sourceUrl} itemKey={ms.key} hideKind="milestone" />}
        />
        <div className="mt-3 md:ml-[52px]">
          <StatGroup variant="inline" label={`${first}'s years at ${org.shortName}`} stats={stats} />
          <p className="mt-2.5 text-small text-fg-2">
            Now {apTitle(ms.role)}
            {ms.firstRole ? (
              <>
                ; joined the staff as {apTitle(ms.firstRole)} in <span className="num">{ms.firstSeason}</span>
              </>
            ) : before ? (
              <>
                ; previously {pastRole(before)} {atOrg(orgOf(before))}
                {before.startYear ? (
                  <>
                    , <StintYears stint={before} />
                  </>
                ) : null}
              </>
            ) : null}
            .
          </p>
          {showInferredNote && <InferredFootnote className="mt-2.5" />}
        </div>
      </div>
      <ActionBar
        set="person"
        subject={person.fullName}
        short={first}
        sharePath={personHref}
        itemKey={ms.key}
        viewer={viewer}
        person={{ id: person.id, slug: person.slug, fullName: person.fullName, firstName: first, claimed: person.claimed }}
      />
    </FeedArticle>
  );
}
