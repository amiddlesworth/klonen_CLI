import Link from "next/link";
import { ChevronsUp, LogIn } from "lucide-react";
import { InferredFootnote } from "@/components/data/InferredYear";
import { QuoteBlock } from "@/components/data/QuoteBlock";
import { Avatar } from "@/components/ui/Avatar";
import type { FeedMove, FeedOrg, FeedReason } from "@/lib/queries/feedx";
import { ActionBar } from "./ActionBar";
import { FeedArticle } from "./FeedArticle";
import { ContextStrip, ItemHeader, ItemMeta } from "./ItemParts";
import { ItemMenu } from "./ItemMenu";
import { MoveRecord } from "./MoveRecord";
import { apTitle, firstNameOf } from "./text";

export type FeedViewerLite = { name: string; tintKey: string };

/** Program name in a feed sentence: linked when it has a program page. */
export function OrgName({ org }: { org: Pick<FeedOrg, "slug" | "shortName" | "inRegistry"> }) {
  return org.inRegistry ? <Link href={`/programs/${org.slug}`}>{org.shortName}</Link> : <b>{org.shortName}</b>;
}

type MoveCardProps = {
  move: FeedMove;
  reason: FeedReason | null;
  viewer: FeedViewerLite;
  /** Explain the dotted underline here (the first item on the page that shows an inferred year). */
  showInferredNote?: boolean;
};

/**
 * Hire or promotion (§8.5 FeedItem): optional context strip, avatar 40, AP headline, meta with the
 * source domain, then the move record (or a facts line) and an optional verbatim staff-bio quote,
 * then the person action set.
 */
export function MoveCard({ move, reason, viewer, showInferredNote }: MoveCardProps) {
  const headingId = `fi-${move.key}`;
  const { person, org } = move;
  const first = firstNameOf(person.fullName, person.firstName);
  const personHref = `/in/${person.slug}`;
  const nameLink = <Link href={personHref}>{person.fullName}</Link>;
  const headline =
    move.kind === "promoted" ? (
      <>
        {nameLink} was promoted to {apTitle(move.role)} at <OrgName org={org} />
      </>
    ) : (
      <>
        {nameLink} joined <OrgName org={org} /> as {apTitle(move.role)}
      </>
    );

  return (
    <FeedArticle labelledBy={headingId} noun="move">
      {reason && <ContextStrip reason={reason} />}
      <div className="px-4 pt-4">
        <ItemHeader
          media={<Avatar name={person.fullName} tintKey={person.slug} size={40} />}
          headingId={headingId}
          headline={headline}
          meta={
            <ItemMeta
              icon={move.kind === "promoted" ? ChevronsUp : LogIn}
              kind={move.kind === "promoted" ? "Promotion" : "New hire"}
              conferenceAbbr={org.conferenceAbbr}
              conference={org.conference}
              sourceUrl={move.sourceUrl}
            />
          }
          menu={<ItemMenu subject={person.fullName} copyPath={personHref} sourceUrl={move.sourceUrl} />}
        />
        {(move.record.length > 0 || move.quote || person.almaMater || showInferredNote) && (
          <div className="mt-3 md:ml-[52px]">
            {move.record.length > 0 ? (
              <MoveRecord rows={move.record} label={move.kind === "promoted" ? `${first}'s roles at ${org.shortName}` : `${first}'s recent record`} />
            ) : (
              person.almaMater && <p className="text-small text-fg-2">Alma mater · {person.almaMater}</p>
            )}
            {move.quote && <QuoteBlock quote={move.quote} attribution={`From the ${org.shortName} staff bio`} className="mt-3" />}
            {showInferredNote && <InferredFootnote className="mt-2.5" />}
          </div>
        )}
      </div>
      <ActionBar set="person" subject={person.fullName} short={first} sharePath={personHref} itemKey={`m-${move.key}`} viewer={viewer} />
    </FeedArticle>
  );
}
