import Link from "next/link";
import { ConferenceBadge } from "@/components/data/Badges";
import { InferredFootnote } from "@/components/data/InferredYear";
import { SourceLink } from "@/components/data/SourceLink";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { CURRENT_SEASON } from "@/lib/brand";
import type { FeedMove } from "@/lib/queries/feedx";
import { Sep } from "./ItemParts";
import { DigestSentence } from "./Sentences";

type TransactionsDigestProps = {
  moves: FeedMove[];
  /** "Show more moves" target (the next feed page), or null on the last page. */
  moreHref: string | null;
  showInferredNote?: boolean;
};

/**
 * "More staff moves" (§8.5 TransactionsDigest): the long tail of moves without a personal reason.
 * Rows split by dividers: program 13/600 + conference chip, one AP sentence 13/20, meta
 * "New hire · source ↗". Footer: full-width secondary "Show more moves".
 */
export function TransactionsDigest({ moves, moreHref, showInferredNote }: TransactionsDigestProps) {
  if (!moves.length) return null;
  return (
    <Card padding="rail" aria-labelledby="digest-title">
      <CardHeader id="digest-title" title="More staff moves" meta={`${CURRENT_SEASON} season · Division III`} />
      <ul>
        {moves.map((m) => (
          <li key={m.key} className="border-t border-divider py-3 first:border-t-0 first:pt-1">
            <p className="flex items-center gap-1.5 text-small font-semibold leading-5">
              {m.org.inRegistry ? (
                <Link href={`/programs/${m.org.slug}`} className="target-24 underline-offset-2 hover:underline">
                  {m.org.shortName}
                </Link>
              ) : (
                m.org.shortName
              )}
              <ConferenceBadge abbr={m.org.conferenceAbbr} name={m.org.conference} />
            </p>
            <p className="mt-0.5 text-small leading-5 text-fg-1">
              <DigestSentence move={m} />
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-fg-3">
              <span>{m.kind === "promoted" ? "Promotion" : "New hire"}</span>
              {m.sourceUrl && (
                <>
                  <Sep />
                  <SourceLink href={m.sourceUrl} className="min-h-6" />
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
      {showInferredNote && <InferredFootnote className="pb-3" />}
      {moreHref && (
        <CardFooter className="mt-0">
          <ButtonLink href={moreHref} fullWidth phone="large">
            Show more moves
          </ButtonLink>
        </CardFooter>
      )}
    </Card>
  );
}
