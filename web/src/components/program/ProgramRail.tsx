import Link from "next/link";
import { Briefcase, Flag } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { OrgMark } from "@/components/ui/OrgMark";
import { TextLink } from "@/components/ui/TextLink";
import { Avatar } from "@/components/ui/Avatar";
import { SeasonRange } from "@/components/data/SeasonRange";
import { BRAND } from "@/lib/brand";
import { conferenceShort } from "@/lib/format";
import type { AlumniEntry, PeerProgram } from "@/lib/queries/program";
import { displayTitle, evidenceReason, peopleCount } from "./text";

/** First to last season across a person's stints here, for a compact rail range ("2008–11"). */
function spanOf(e: AlumniEntry): { start: number; end: number | null; current: boolean } | null {
  const dated = e.stints.filter((s) => s.startYear);
  if (!dated.length) return null;
  const current = dated.some((s) => s.isCurrent);
  const start = Math.min(...dated.map((s) => s.startYear!));
  const end = current ? null : Math.max(...dated.map((s) => s.endYear ?? s.startYear!));
  return { start, end, current };
}

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
              <span className="num shrink-0 text-right text-caption text-fg-3">{p.staff ? `${p.staff} staff` : "No staff data"}</span>
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

/**
 * Rail: Coaches from here (§8.6). Former players who now coach, with "Played here {range}" as the
 * context line. Up to 4; links to the full "Played here" list on the Alumni coaches tab.
 */
export function CoachesFromHereCard({ players, shortName, allHref }: { players: AlumniEntry[]; shortName: string; allHref: string }) {
  if (!players.length) return null;
  const shown = players.slice(0, 4);
  return (
    <Card padding="rail" aria-labelledby="from-here-title">
      <CardHeader id="from-here-title" size="rail" title="Coaches from here" meta={peopleCount(players.length)} subtitle={`Played at ${shortName}, now coaching`} />
      <ul className="mt-2 divide-y divide-divider">
        {shown.map((e) => {
          const span = spanOf(e);
          const where = [displayTitle(e.person.currentTitle), e.person.org?.shortName].filter(Boolean).join(" · ");
          return (
            <li key={e.person.id} className="py-3 first:pt-1 last:pb-0">
              <Link href={`/in/${e.person.slug}`} className="group/row flex min-h-11 items-start gap-3 rounded-xs">
                <Avatar name={e.person.fullName} tintKey={e.person.slug} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{e.person.fullName}</span>
                  {where && <span className="block truncate text-caption text-fg-2">{where}</span>}
                  <ContextLine icon={Flag}>
                    {span ? (
                      <>
                        Played here{" "}
                        <SeasonRange
                          variant="compact"
                          startYear={span.start}
                          endYear={span.end}
                          isCurrent={span.current}
                          inferred={e.inferred}
                          inferredReason={e.inferred ? evidenceReason(e.inferredEvidence) : null}
                          className="font-normal"
                        />
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
 * Rail: Hiring? A card for employers (and visitors who might be one). The program's own athletic
 * director gets a direct "Post a job"; everyone else gets the general pitch. Secondary button only:
 * Follow is the page's one primary action.
 */
export function HiringCard({ programShortName, isOwnProgram }: { programShortName: string; isOwnProgram: boolean }) {
  return (
    <Card padding="rail" aria-labelledby="hiring-title">
      <CardHeader id="hiring-title" size="rail" title={isOwnProgram ? `Hiring at ${programShortName}?` : "Hiring?"} />
      <p className="text-small text-fg-2">
        {isOwnProgram
          ? "Post an opening and track candidates in your hiring pipeline."
          : `Post an opening on ${BRAND.name} and find candidates through the coaching tree.`}
      </p>
      <ButtonLink href="/employers/jobs/new" icon={Briefcase} size="sm" phone="large" fullWidth className="mt-3">
        Post a job
      </ButtonLink>
    </Card>
  );
}

/** Light pages' rail: where the coaches who worked or played here coach now (programs with counts). */
export function WhereNowCard({ entries }: { entries: AlumniEntry[] }) {
  const byOrg = new Map<string, { slug: string; shortName: string; name: string | null; ids: Set<string> }>();
  for (const e of entries) {
    const o = e.person.org;
    if (!o) continue;
    const row = byOrg.get(o.slug) ?? { slug: o.slug, shortName: o.shortName, name: e.currentOrgName, ids: new Set<string>() };
    row.ids.add(e.person.id);
    byOrg.set(o.slug, row);
  }
  const rows = [...byOrg.values()].sort((a, b) => b.ids.size - a.ids.size || a.shortName.localeCompare(b.shortName)).slice(0, 6);
  if (!rows.length) return null;
  return (
    <Card padding="rail" aria-labelledby="where-now-title">
      <CardHeader id="where-now-title" size="rail" title="Where they coach now" subtitle="Current programs of the coaches on this page" />
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
    </Card>
  );
}
