import Link from "next/link";
import { ArrowRightLeft, ChevronsUp, LogIn, type LucideIcon } from "lucide-react";
import { InferredFootnote } from "@/components/data/InferredYear";
import { QuoteBlock } from "@/components/data/QuoteBlock";
import { Avatar } from "@/components/ui/Avatar";
import { formerStaffStint, type FeedMove, type FeedOrg, type FeedReason, type MoveKind } from "@/lib/queries/feedx";
import { ActionBar } from "./ActionBar";
import { FeedArticle } from "./FeedArticle";
import { ContextStrip, ItemHeader, ItemMeta } from "./ItemParts";
import { ItemMenu } from "./ItemMenu";
import { MoveRecord } from "./MoveRecord";
import type { HideKind } from "./feedPrefs";
import { FormerStaffFacts, UndatedLine } from "./Sentences";
import { apTitle, firstNameOf } from "./text";

export type FeedViewerLite = { name: string; tintKey: string };

/** The meta label and icon for each kind of move (§8.5 FeedItem meta; §7 icons). */
export const MOVE_KIND: Record<MoveKind, { label: string; icon: LucideIcon }> = {
  joined: { label: "New hire", icon: LogIn },
  returned: { label: "Returning hire", icon: LogIn },
  promoted: { label: "Promotion", icon: ChevronsUp },
  moved: { label: "New role", icon: ArrowRightLeft },
};

/** What "Hide moves like this" hides for each kind of move. */
export const MOVE_HIDE_KIND: Record<MoveKind, HideKind> = { joined: "hire", returned: "hire", promoted: "promotion", moved: "role-change" };

/**
 * Program name in a feed sentence: linked when it has a program page. Never split across lines, so
 * "Pacific (OR)" can't leave a headline line starting with "(".
 */
export function OrgName({ org }: { org: Pick<FeedOrg, "slug" | "shortName" | "inRegistry"> }) {
  return org.inRegistry ? (
    <Link href={`/programs/${org.slug}`} className="whitespace-nowrap">
      {org.shortName}
    </Link>
  ) : (
    <b className="whitespace-nowrap">{org.shortName}</b>
  );
}

/** The AP headline for a move (§6.3), worded by what the source supports. */
function Headline({ move }: { move: FeedMove }) {
  const name = <Link href={`/in/${move.person.slug}`}>{move.person.fullName}</Link>;
  const org = <OrgName org={move.org} />;
  const title = apTitle(move.role);
  switch (move.kind) {
    case "promoted":
      return (
        <>
          {name} was promoted to {title} at {org}
        </>
      );
    case "moved":
      return (
        <>
          {name} moved to {title} at {org}
        </>
      );
    case "returned":
      return (
        <>
          {name} returned to {org} as {title}
        </>
      );
    default:
      return (
        <>
          {name} joined {org} as {title}
        </>
      );
  }
}

type MoveCardProps = {
  move: FeedMove;
  reason: FeedReason | null;
  viewer: FeedViewerLite;
  /** The viewer's program id, to back up a "coached at your program" reason inside the card. */
  viewerOrgId?: string | null;
  /** Explain the dotted underline here (the first item on the page that shows an inferred year). */
  showInferredNote?: boolean;
  /** The first item of its kind on the page (holds the placeholder when the viewer hides the kind). */
  firstOfKind?: boolean;
};

/**
 * Hire, return, promotion or new role (§8.5 FeedItem): optional context strip, avatar 40, AP
 * headline, meta with the source domain, then the move record (or a facts line) and an optional
 * verbatim staff-bio quote, then the person action set.
 */
export function MoveCard({ move, reason, viewer, viewerOrgId, showInferredNote, firstOfKind }: MoveCardProps) {
  const headingId = `fi-${move.key}`;
  const { person, org } = move;
  const first = firstNameOf(person.fullName, person.firstName);
  const personHref = `/in/${person.slug}`;
  const kind = MOVE_KIND[move.kind];
  const withinProgram = move.kind === "promoted" || move.kind === "moved";

  // "Pacific (OR) · coached at your program" needs its receipt in the card: when the record doesn't
  // show that stint, one facts line does.
  const formerFacts = formerStaffStint(move, reason, viewerOrgId ?? null);
  // Stints with no years: named in one facts line, never as rows of the dated record (§8.3).
  const undated = move.undated.filter((s) => s.orgId !== formerFacts?.orgId);
  const showBody = move.record.length > 0 || move.quote || person.almaMater || formerFacts || undated.length > 0 || showInferredNote;
  const factsGap = (first: boolean) => (first ? "text-small text-fg-2" : "mt-1.5 text-small text-fg-2");

  return (
    <FeedArticle labelledBy={headingId} hideKind={MOVE_HIDE_KIND[move.kind]} firstOfKind={firstOfKind} note={showInferredNote ? <InferredFootnote /> : undefined}>
      {reason && <ContextStrip reason={reason} />}
      <div className="px-4 pt-4">
        <ItemHeader
          media={<Avatar name={person.fullName} tintKey={person.slug} size={40} />}
          headingId={headingId}
          headline={<Headline move={move} />}
          meta={<ItemMeta icon={kind.icon} kind={kind.label} conferenceAbbr={org.conferenceAbbr} conference={org.conference} sourceUrl={move.sourceUrl} />}
          menu={<ItemMenu subject={person.fullName} copyPath={personHref} sourceUrl={move.sourceUrl} itemKey={`m-${move.key}`} hideKind={MOVE_HIDE_KIND[move.kind]} />}
        />
        {showBody && (
          <div className="mt-3 md:ml-[52px]">
            {move.record.length > 0 ? (
              <MoveRecord rows={move.record} label={withinProgram ? `${first}'s roles at ${org.shortName}` : `${first}'s recent record`} />
            ) : (
              person.almaMater && !formerFacts && !undated.length && <p className="text-small text-fg-2">Alma mater · {person.almaMater}</p>
            )}
            {undated.length > 0 && (
              <p className={factsGap(move.record.length === 0)}>
                <UndatedLine stints={undated} orgId={org.id} />
              </p>
            )}
            {formerFacts && (
              <p className={factsGap(move.record.length === 0 && !undated.length)}>
                <FormerStaffFacts stint={formerFacts} />
              </p>
            )}
            {move.quote && <QuoteBlock quote={move.quote} attribution={`From the ${org.shortName} staff bio`} className="mt-3" />}
            {showInferredNote && <InferredFootnote className="mt-2.5" />}
          </div>
        )}
      </div>
      <ActionBar
        set="person"
        subject={person.fullName}
        short={first}
        sharePath={personHref}
        itemKey={`m-${move.key}`}
        viewer={viewer}
        person={{ id: person.id, slug: person.slug, fullName: person.fullName, firstName: first, claimed: person.claimed }}
      />
    </FeedArticle>
  );
}
