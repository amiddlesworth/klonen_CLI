import Link from "next/link";
import { Search } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { ContextLine } from "@/components/data/ContextLine";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { UnclaimedChip } from "@/components/ui/Chip";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { TextLink } from "@/components/ui/TextLink";
import type { SampleProfile } from "@/lib/queries/landing";
import { SectionHeader } from "./SectionHeader";

/**
 * "33 seasons · 13 stops · 15 in tree", numbers 600 --fg-1 (the same numbers as the profile header).
 * At md, where the card is a row, the three facts stack in the card's right column.
 */
function CareerLine({ p }: { p: SampleProfile }) {
  const parts = [
    p.seasons !== null ? { n: p.seasons, label: p.seasons === 1 ? "season" : "seasons" } : null,
    { n: p.stops, label: p.stops === 1 ? "stop" : "stops" },
    { n: p.treeSize, label: "in tree" },
  ].filter((x): x is { n: number; label: string } => !!x);
  return (
    <p className="text-small text-fg-2 md:max-lg:flex md:max-lg:flex-col md:max-lg:gap-0.5">
      {parts.map((x, i) => (
        <span key={x.label} className="whitespace-nowrap">
          {i > 0 && <span className="md:max-lg:hidden"> · </span>}
          <span className="num font-semibold text-fg-1">{x.n}</span> {x.label}
        </span>
      ))}
    </p>
  );
}

/**
 * Compact profile card (§8.10): avatar 48, name, "{title} at {program}", division and conference
 * chips, Unclaimed chip where true, the most recent earlier stop, then the career numbers. The name
 * is the link and its hit area stretches over the whole card. Padding matches the other landing
 * cards (16 on phone, 20/24 from md). Avatar left of the text at every width; the career numbers
 * sit on the text column (48 avatar + 12 gap) under a divider, except at md, where the cards stack
 * full width and read as rows: facts left, the career numbers in a right column.
 */
function SampleProfileCard({ p }: { p: SampleProfile }) {
  return (
    <article className="group/card relative flex h-full flex-col border-y border-border bg-surface p-4 md:rounded-md md:border md:px-6 md:py-5 md:max-lg:flex-row md:max-lg:items-center md:max-lg:gap-6">
      <div className="flex min-w-0 flex-1 gap-3">
        <Avatar name={p.fullName} tintKey={p.slug} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 text-subtitle font-semibold">
              <Link
                href={`/in/${p.slug}`}
                className="underline-offset-2 after:absolute after:inset-0 after:rounded-none after:content-[''] group-hover/card:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus md:after:rounded-md"
              >
                {p.fullName}
              </Link>
            </h3>
            {!p.claimed && <UnclaimedChip />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-small text-fg-2">
            {p.currentTitle ? `${p.currentTitle} at ` : ""}
            <span className="font-medium text-fg-1">{p.org.shortName}</span>
          </p>
          <ProgramBadges level={p.org.level} conferenceAbbr={p.org.conferenceAbbr} conference={p.org.conference} className="mt-2" />
          {p.previous.length > 0 && (
            // The program name gets the line (two at most); the stop count lives in the career numbers.
            <ContextLine className="mt-2">
              <span className="line-clamp-2" title={p.previous[0]}>
                Previously {p.previous[0]}
              </span>
            </ContextLine>
          )}
        </div>
      </div>
      <div className="ml-15 mt-3 border-t border-divider pt-3 md:max-lg:m-0 md:max-lg:flex md:max-lg:w-36 md:max-lg:shrink-0 md:max-lg:items-center md:max-lg:self-stretch md:max-lg:border-l md:max-lg:border-t-0 md:max-lg:pl-6 md:max-lg:pt-0">
        <CareerLine p={p} />
      </div>
    </article>
  );
}

/**
 * Sample profiles (§8.10): three real current head coaches with long careers, linking to their
 * profiles. The same three at every width: three across from lg, a stack of row cards at md, a
 * stack of cards on phone.
 */
export function SampleProfiles({ profiles }: { profiles: SampleProfile[] | null }) {
  return (
    <section aria-labelledby="samples-title">
      <SectionHeader
        id="samples-title"
        title="Real coaching careers"
        description="Current Division III head coaches with long careers, each built from public staff bios."
        action={
          <TextLink href="/search" arrow target24>
            Search all coaches
          </TextLink>
        }
      />
      {profiles === null ? (
        <Card className="px-4 py-3 md:px-6">
          <ErrorState message="We couldn't load the sample profiles." retryHref="/" />
        </Card>
      ) : profiles.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="No sample profiles yet."
            description="Profiles appear here as staff pages are added. Search for a coach or a program meanwhile."
            action={<ButtonLink href="/search">Go to search</ButtonLink>}
          />
        </Card>
      ) : (
        <ul className="grid gap-2 md:gap-3 lg:grid-cols-3">
          {profiles.map((p) => (
            <li key={p.id} className="min-w-0">
              <SampleProfileCard p={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
