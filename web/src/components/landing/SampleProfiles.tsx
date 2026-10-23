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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "33 seasons · 13 stops · 15 in tree", numbers 600 --fg-1 (the same numbers as the profile header). */
function CareerLine({ p }: { p: SampleProfile }) {
  const parts = [
    p.seasons !== null ? { n: p.seasons, label: p.seasons === 1 ? "season" : "seasons" } : null,
    { n: p.stops, label: p.stops === 1 ? "stop" : "stops" },
    { n: p.treeSize, label: "in tree" },
  ].filter((x): x is { n: number; label: string } => !!x);
  return (
    <p className="text-small text-fg-2">
      {parts.map((x, i) => (
        <span key={x.label} className="whitespace-nowrap">
          {i > 0 && " · "}
          <span className="num font-semibold text-fg-1">{x.n}</span> {x.label}
        </span>
      ))}
    </p>
  );
}

/**
 * Compact profile card (§8.10): avatar 48, name, "{title} at {program}", division and conference
 * chips, Unclaimed chip where true, the most recent earlier stop, then the career numbers. The name
 * is the link and its hit area stretches over the whole card. Phone: avatar left of the text.
 */
function SampleProfileCard({ p }: { p: SampleProfile }) {
  const more = p.previous.length - 1;
  return (
    <article className="group/card relative flex h-full flex-col border-y border-border bg-surface p-4 md:rounded-md md:border">
      <div className="flex flex-1 gap-3 md:flex-col">
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
            <ContextLine className="mt-2">
              <span className="line-clamp-2">
                Previously {p.previous[0]}
                {more > 0 && (
                  <>
                    {" "}
                    and <span className="whitespace-nowrap">{plural(more, "more stop", "more stops")}</span>
                  </>
                )}
              </span>
            </ContextLine>
          )}
        </div>
      </div>
      {/* Phone: on the text column (48 avatar + 12 gap), so the card reads as avatar | facts. */}
      <div className="mt-3 border-t border-divider pt-3 max-md:ml-15">
        <CareerLine p={p} />
      </div>
    </article>
  );
}

/**
 * Sample profiles (§8.10): real current head coaches with long careers, linking to their profiles.
 * Four across on desktop, two on tablet, a stack of full-bleed cards on phone.
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
        <ul className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
          {profiles.map((p, i) => (
            // Three on phone (§8.10), so the stack stays short; four from md.
            <li key={p.id} className={i >= 3 ? "min-w-0 max-md:hidden" : "min-w-0"}>
              <SampleProfileCard p={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
