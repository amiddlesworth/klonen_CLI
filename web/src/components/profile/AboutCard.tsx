import { TextQuote } from "lucide-react";
import { QuoteBlock } from "@/components/data/QuoteBlock";
import { SectionCard } from "@/components/data/SectionCard";
import { SourceLink } from "@/components/data/SourceLink";
import { TextLink } from "@/components/ui/TextLink";

type AboutCardProps = {
  /** Written by the coach after claiming; never generated. */
  about: string | null;
  /** Short verbatim quote from the source bio. */
  excerpt: string | null;
  sourceUrl: string | null;
  firstName: string;
  slug: string;
  owner: boolean;
};

/**
 * About (§8.4). Claimed: the coach's own text. Unclaimed: a verbatim quote from the staff bio with
 * its attribution (we never write biography about real people), or the empty state.
 */
export function AboutCard({ about, excerpt, sourceUrl, firstName, slug, owner }: AboutCardProps) {
  const who = owner ? "You" : firstName;
  const action = owner ? (
    <TextLink href={`/claim/${slug}`} arrow target24 className="text-small">
      Claim to edit
    </TextLink>
  ) : undefined;

  if (about?.trim()) {
    return (
      <SectionCard id="about" title="About" action={action}>
        <p className="max-w-prose whitespace-pre-line text-prose">{about.trim()}</p>
      </SectionCard>
    );
  }

  if (excerpt?.trim()) {
    return (
      <SectionCard id="about" title="About" action={action}>
        <QuoteBlock
          quote={excerpt}
          size="md"
          attribution={
            sourceUrl ? (
              <>
                {/* min-h-6: a 24px target on the 16px caption line (§11.7; target-24's padding alone gives 22px). */}
                Quoted from the staff bio · <SourceLink href={sourceUrl} className="min-h-6" />
              </>
            ) : (
              "Quoted from the staff bio"
            )
          }
        />
        <p className="mt-3 text-caption text-fg-3">
          {who} can replace this with {owner ? "your" : "their"} own About after claiming the profile.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      id="about"
      title="About"
      action={action}
      empty={{ icon: TextQuote, title: "No About yet.", description: `${who} can add one after claiming the profile.` }}
    />
  );
}
