import Link from "next/link";
import { LogIn } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredFootnote } from "@/components/data/InferredYear";
import { Avatar } from "@/components/ui/Avatar";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import { titleShort } from "@/lib/format";
import type { FeedMove, FeedOrg, FeedReason } from "@/lib/queries/feedx";
import { ActionBar } from "./ActionBar";
import { FeedArticle } from "./FeedArticle";
import { ContextStrip, ItemHeader, ItemMeta } from "./ItemParts";
import { ItemMenu } from "./ItemMenu";
import { OrgName, type FeedViewerLite } from "./MoveCard";
import { ConnectButton } from "./PersonActions";
import { PreviouslyLine } from "./Sentences";
import { apNumber } from "./text";

/** Rows shown before "Show all": a group of five or fewer shows everyone. */
const VISIBLE = 4;

function groupNoun(moves: FeedMove[]): string {
  const groups = new Set(moves.map((m) => m.roleGroup));
  if (groups.size === 1 && groups.has("position_coach")) return "assistant coaches";
  if (groups.size === 1 && groups.has("ga_analyst")) return "graduate assistants and analysts";
  return "staff members";
}

type GroupCardProps = {
  org: FeedOrg;
  moves: FeedMove[];
  reason: FeedReason | null;
  sourceUrl: string | null;
  viewer: FeedViewerLite;
  showInferredNote?: boolean;
};

/**
 * Grouped hires (§8.5): one program, two or more new people. OrgMark 40, "{Org} named five new
 * assistant coaches", then people rows split by dividers (avatar 32, name 13/600, short title 12
 * --fg-1, "Previously …" context line, Connect each), then the program action set.
 */
export function GroupCard({ org, moves, reason, sourceUrl, viewer, showInferredNote }: GroupCardProps) {
  const headingId = `fi-g-${org.id}`;
  const n = moves.length;
  const shown = n <= VISIBLE + 1 ? moves : moves.slice(0, VISIBLE);
  const programHref = `/programs/${org.slug}`;
  return (
    <FeedArticle labelledBy={headingId} noun="update">
      {reason && <ContextStrip reason={reason} />}
      <div className="px-4 pt-4">
        <ItemHeader
          media={<OrgMark shortName={org.shortName} name={org.name} size={40} />}
          headingId={headingId}
          headline={
            <>
              <OrgName org={org} /> named {apNumber(n)} new {groupNoun(moves)}
            </>
          }
          meta={<ItemMeta icon={LogIn} kind={`${n} new hires`} conferenceAbbr={org.conferenceAbbr} conference={org.conference} sourceUrl={sourceUrl} />}
          menu={<ItemMenu subject={`${org.shortName} staff hires`} copyPath={programHref} sourceUrl={sourceUrl} noun="update" />}
        />
        <div className="mt-3 md:ml-[52px]">
          <ul aria-label={`New staff at ${org.shortName}`}>
            {shown.map((m) => (
              <li key={m.key} className="flex items-start gap-3 border-t border-divider py-2.5 first:border-t-0 first:pt-0.5">
                <Avatar name={m.person.fullName} tintKey={m.person.slug} size={32} />
                <div className="min-w-0 flex-1">
                  <Link href={`/in/${m.person.slug}`} className="target-24 inline-block text-small font-semibold underline-offset-2 hover:underline">
                    {m.person.fullName}
                  </Link>
                  <p className="text-caption text-fg-1">{titleShort(m.role)}</p>
                  {m.previous && (
                    <ContextLine>
                      <PreviouslyLine move={m} />
                    </ContextLine>
                  )}
                </div>
                <ConnectButton name={m.person.fullName} />
              </li>
            ))}
          </ul>
          {shown.length < n && (
            <div className="border-t border-divider pt-2.5">
              <TextLink href={`${programHref}?tab=staff`} arrow className="inline-flex min-h-6 items-center text-small max-md:min-h-11">
                See all {n} on the {org.shortName} staff
              </TextLink>
            </div>
          )}
          {showInferredNote && <InferredFootnote className="mt-2.5" />}
        </div>
      </div>
      <ActionBar set="program" subject={org.shortName} short={org.shortName} sharePath={programHref} itemKey={`g-${org.id}`} viewer={viewer} />
    </FeedArticle>
  );
}
