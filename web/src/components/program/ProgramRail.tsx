import Link from "next/link";
import { Briefcase, Flag } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredFootnote } from "@/components/data/InferredYear";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import { Avatar } from "@/components/ui/Avatar";
import { BRAND } from "@/lib/brand";
import { conferenceShort } from "@/lib/format";
import { compactSpan, type AlumniEntry, type PeerProgram } from "@/lib/queries/program";
import { CompactRange, rangeHasInferred } from "./LedgerRange";
import { displayTitle, jobsCount, peopleCount } from "./text";

/** The same words wherever a registry program's staff page hasn't been read (header stat, peers rail). */
export const STAFF_NOT_READ = "Staff not read yet";

const PEER_LIMIT = 6;

/** Rail: Conference peers (§8.6), programs with tile 32 and their staff counts. Hidden when empty. */
export function ConferencePeersCard({ peers, conferenceAbbr, conferenceName }: { peers: PeerProgram[]; conferenceAbbr: string | null; conferenceName: string | null }) {
  if (!peers.length) return null;
  const abbr = conferenceShort(conferenceAbbr);
  // Up to 6, programs with the most staff on the network first; the footer link lists the whole conference.
  const shown = [...peers].sort((a, b) => b.staff - a.staff || a.shortName.localeCompare(b.shortName)).slice(0, PEER_LIMIT);
  return (
    <Card padding="rail" aria-labelledby="peers-title">
      <CardHeader id="peers-title" size="rail" title="Conference peers" meta={`${peers.length} ${peers.length === 1 ? "program" : "programs"}`} subtitle={conferenceName ?? abbr} />
      <ul className="mt-2 divide-y divide-divider">
        {shown.map((p) => (
          <li key={p.id} className="py-2 first:pt-1 last:pb-0">
            <Link href={`/programs/${p.slug}`} className="group/row flex min-h-11 items-center gap-3 rounded-xs">
              <OrgMark shortName={p.shortName} name={p.name} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{p.shortName}</span>
                <span className="block truncate text-caption text-fg-3">
                  {[p.nickname, p.state].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="num shrink-0 text-right text-caption text-fg-3">{p.staff ? `${p.staff} staff` : STAFF_NOT_READ}</span>
            </Link>
          </li>
        ))}
      </ul>
      {abbr && (
        <CardFooter>
          <TextLink href={`/search?type=programs&conference=${encodeURIComponent(abbr)}`} arrow target24 className="text-small">
            {peers.length > shown.length ? `All ${abbr} programs` : `Search ${abbr} programs`}
          </TextLink>
        </CardFooter>
      )}
    </Card>
  );
}

/** Rows the Coaches from here card shows (the page decides from the same slice who explains a dotted year). */
export const COACHES_FROM_HERE_LIMIT = 4;

/**
 * Rail: Coaches from here (§8.6). Former players who now coach, with "Played here {range}" as the
 * context line. Up to 4; links to the full "Played here" list on the Alumni coaches tab. The current
 * program leads the second line and the title truncates after it. When the main column doesn't
 * explain dotted years (`explainInferred`), the card does, under its rows.
 */
export function CoachesFromHereCard({
  players,
  shortName,
  allHref,
  explainInferred = true,
}: {
  players: AlumniEntry[];
  shortName: string;
  allHref: string;
  explainInferred?: boolean;
}) {
  if (!players.length) return null;
  const shown = players.slice(0, COACHES_FROM_HERE_LIMIT);
  const showFootnote = explainInferred && shown.some((e) => rangeHasInferred(e.stints, "compact"));
  return (
    <Card padding="rail" aria-labelledby="from-here-title">
      <CardHeader id="from-here-title" size="rail" title="Coaches from here" meta={peopleCount(players.length)} subtitle={`Played at ${shortName}, now coaching`} />
      <ul className="mt-2 divide-y divide-divider">
        {shown.map((e) => {
          const dated = !!compactSpan(e.stints);
          const program = e.person.org?.shortName;
          const title = displayTitle(e.person.currentTitle);
          return (
            <li key={e.person.id} className="py-3 first:pt-1 last:pb-0">
              <Link href={`/in/${e.person.slug}`} className="group/row flex min-h-11 items-start gap-3 rounded-xs">
                <Avatar name={e.person.fullName} tintKey={e.person.slug} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{e.person.fullName}</span>
                  {(program || title) && (
                    <span className="flex min-w-0 text-caption text-fg-2">
                      {program && <span className="max-w-full shrink-0 truncate font-medium">{program}</span>}
                      {program && title && (
                        <span aria-hidden="true" className="shrink-0 whitespace-pre">
                          {" · "}
                        </span>
                      )}
                      {program && title && <span className="sr-only">, </span>}
                      {title && <span className="min-w-0 truncate">{title}</span>}
                    </span>
                  )}
                  <ContextLine icon={Flag}>
                    {dated ? (
                      <>
                        Played here <CompactRange stints={e.stints} className="font-normal" />
                      </>
                    ) : (
                      "Played here"
                    )}
                  </ContextLine>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {showFootnote && <InferredFootnote className="mt-3">Dotted years are inferred from the coach&apos;s bio, not stated in it.</InferredFootnote>}
      {players.length > shown.length && (
        <CardFooter>
          <TextLink href={allHref} arrow target24 className="text-small">
            All {players.length} former players
          </TextLink>
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * Rail: Hiring? A card for employers on other programs (and visitors who might be one): the general
 * pitch with a secondary "Post a job" (Follow is the page's one primary action).
 */
export function HiringCard() {
  return (
    <Card padding="rail" aria-labelledby="hiring-title">
      <CardHeader id="hiring-title" size="rail" title="Hiring?" />
      <p className="text-small text-fg-2">Post an opening on {BRAND.name} and find candidates through the coaching tree.</p>
      <ButtonLink href="/employers/jobs/new" icon={Briefcase} size="sm" phone="large" fullWidth className="mt-3">
        Post a job
      </ButtonLink>
    </Card>
  );
}

/**
 * Rail: Your hiring, for the athletic director of this program (from the session). The header carries
 * "Post a job" as the page's primary action, so this card holds what the AD tracks: the program's open
 * jobs and the way into the pipeline they own.
 */
export function YourHiringCard({ programShortName, jobs, sampleJobs, jobsHref }: { programShortName: string; jobs: number; sampleJobs: number; jobsHref: string }) {
  return (
    <Card padding="rail" aria-labelledby="your-hiring-title">
      <CardHeader id="your-hiring-title" size="rail" title="Your hiring" subtitle={`${programShortName} · your program`} />
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-2">
        <Link href={jobsHref} className="target-24 rounded-xs font-medium text-fg-1 underline-offset-2 hover:underline">
          <span className="num">{jobsCount(jobs)}</span>
        </Link>
        {jobs > 0 && sampleJobs === jobs && <SampleChip label="Sample" />}
      </p>
      <p className="mt-1 text-small text-fg-2">Shortlists, candidate notes and stages live in your hiring pipeline.</p>
      <CardFooter>
        <TextLink href="/employers/pipeline" arrow target24 className="text-small">
          View pipeline
        </TextLink>
      </CardFooter>
    </Card>
  );
}

const WHERE_NOW_LIMIT = 8;

/** Light pages' rail: where the coaches who worked or played here coach now (programs with counts). */
export function WhereNowCard({ entries }: { entries: AlumniEntry[] }) {
  const byOrg = new Map<string, { slug: string; shortName: string; name: string | null; ids: Set<string> }>();
  for (const e of entries) {
    const o = e.person.org;
    if (!o || o.slug.startsWith("unknown-")) continue;
    const row = byOrg.get(o.slug) ?? { slug: o.slug, shortName: o.shortName, name: e.currentOrgName, ids: new Set<string>() };
    row.ids.add(e.person.id);
    byOrg.set(o.slug, row);
  }
  const all = [...byOrg.values()].sort((a, b) => b.ids.size - a.ids.size || a.shortName.localeCompare(b.shortName));
  if (!all.length) return null;
  const rows = all.slice(0, WHERE_NOW_LIMIT);
  const more = all.length - rows.length;
  return (
    <Card padding="rail" aria-labelledby="where-now-title">
      <CardHeader
        id="where-now-title"
        size="rail"
        title="Where they coach now"
        meta={`${all.length} ${all.length === 1 ? "program" : "programs"}`}
        subtitle="Current programs of the coaches on this page"
      />
      <ul className="mt-2 divide-y divide-divider">
        {rows.map((r) => (
          <li key={r.slug} className="py-2 first:pt-1 last:pb-0">
            <Link href={`/programs/${r.slug}`} className="group/row flex min-h-11 items-center gap-3 rounded-xs">
              <OrgMark shortName={r.shortName} name={r.name} size={32} />
              <span className="min-w-0 flex-1 truncate text-small font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{r.shortName}</span>
              <span className="num shrink-0 text-caption text-fg-3">{r.ids.size === 1 ? "1 coach" : `${r.ids.size} coaches`}</span>
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="mt-3 border-t border-divider pt-3 text-caption text-fg-3">
          And {more} more {more === 1 ? "program" : "programs"}, in the lists on this page.
        </p>
      )}
    </Card>
  );
}
