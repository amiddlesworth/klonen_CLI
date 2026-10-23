import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight, Network } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredKey } from "@/components/data/InferredYear";
import { PersonRow } from "@/components/data/PersonRow";
import { PersonRowAction } from "@/components/data/PersonRowAction";
import { CurrentProgramCard as SharedCurrentProgramCard } from "@/components/data/CurrentProgramCard";
import { SectionCard } from "@/components/data/SectionCard";
import { Icon } from "@/components/ui/Icon";
import { conferenceShort, titleShort } from "@/lib/format";
import type { PersonSummary } from "@/lib/queries/people";
import { getProgramCounts } from "@/lib/queries/program";
import type { ProgramCard, SameTreeLink } from "@/lib/queries/profile";
import { treeYearsView, type TreeYearsView } from "./model";
import { InlineYears } from "./TreeYears";

/** Every rail row is a football coach: "Head Football Coach" reads "Head Coach" there. */
const FOOTBALL_IN_TITLE: [RegExp, string][] = [
  [/\bHead Coach of Football\b/gi, "Head Coach"],
  [/\bFootball Head Coach\b/gi, "Head Coach"],
  [/\bFootball (Coach|Coordinator)\b/gi, "$1"],
];

/**
 * A title in a rail row: always abbreviated with titleShort() (§6.3, compact rows), not only past its
 * length limit, so "Offensive Coordinator" reads "OC" instead of being cut to "Offensive C…".
 */
export function railTitle(title: string): string {
  let t = titleShort(title, 0);
  for (const [re, sub] of FOOTBALL_IN_TITLE) t = t.replace(re, sub);
  return t;
}

/** The title keeps at least this much room (or its own width when shorter) before the program takes the rest. */
const TITLE_KEEP_PX = 90;
/**
 * Generous width of a 12px Inter character (capitals included), plus the ellipsis slack, to tell a short
 * title from a long one without measuring: a short title ("Head Coach") gets its whole width.
 */
const CAPTION_CHAR_PX = 7;
const TITLE_SLACK_PX = 6;

/**
 * The "Title · Program" line of a rail person row (§12: truncate the title, keep the context). The title
 * truncates first; the program stays whole unless it would leave the title less than ~90px (or its own
 * width when shorter), and only then truncates too.
 */
function TitleOrg({ title, org }: { title: string | null; org: string | null }) {
  if (!title || !org) {
    const only = title ?? org;
    return only ? <span className="block truncate">{only}</span> : null;
  }
  const keep = Math.min(TITLE_KEEP_PX, Math.ceil(title.length * CAPTION_CHAR_PX) + TITLE_SLACK_PX);
  return (
    <span className="flex min-w-0">
      <span className="min-w-0 truncate">{title}</span>
      <span style={{ "--keep": `${keep}px` } as CSSProperties} className="max-w-[calc(100%-var(--keep))] shrink-0 truncate pl-1">
        {`·\u00a0${org}`}
      </span>
    </span>
  );
}

/**
 * Rail: Current program (§8.4). The shared CurrentProgramCard (components/data, also the job rail),
 * with the program page's own counts, so Staff listed · Alumni coaches · Open jobs match that page.
 */
export async function CurrentProgramCard({ program }: { program: ProgramCard }) {
  const counts = await getProgramCounts(program.id);
  return <SharedCurrentProgramCard org={program} counts={counts} />;
}

/**
 * "Via Nic Brockhoff · both at George Fox, 2015–24": how a Same tree person connects. The years are
 * shown only when the source pins them, dotted when inferred.
 */
function ViaLine({ link: l }: { link: SameTreeLink }) {
  const view: TreeYearsView = treeYearsView(l.years, (id) => (id === l.person.id ? l.person.fullName : id === l.via.id ? l.via.fullName : undefined));
  const first = l.person.fullName.split(" ")[0];
  const how =
    l.relation === "alongside"
      ? `both at ${l.orgShortName}`
      : l.relation === "via_coached"
        ? `${first}'s head coach at ${l.orgShortName}`
        : `coached under ${first} at ${l.orgShortName}`;
  // " · " before the years, never ", " (a program name can hold commas: "University of California, Davis"),
  // with no-break spaces so the years stay with the program's last word and no line starts with "·".
  return (
    <>
      Via {l.via.fullName} · {how}
      {view.kind === "range" && (
        <>
          {"\u00a0·\u00a0"}
          <InlineYears view={view} />
        </>
      )}
    </>
  );
}

/** Whether a Same tree card shows an inferred year (the page explains the mark once). */
export function sameTreeInferred(links: SameTreeLink[]): boolean {
  return links.some((l) => treeYearsView(l.years, () => undefined).kind === "range" && l.years.inferred);
}

/**
 * Rail: Same tree (§8.4): two steps from the coach, through the current staff, excluding anyone in
 * the tree card. Hidden when empty.
 */
export function SameTreeCard({
  links,
  firstName,
  programShortName,
  explainInferred,
}: {
  links: SameTreeLink[];
  firstName: string;
  programShortName: string;
  /** Explain the dotted year here (when nothing else on the page does). */
  explainInferred?: boolean;
}) {
  if (!links.length) return null;
  return (
    <SectionCard id="same-tree" size="rail" title="Same tree" subtitle={`Two steps from ${firstName}, through the ${programShortName} staff`}>
      <ul className="mt-1">
        {links.map((l) => {
          const p = l.person;
          return (
            <li key={p.id} className="border-t border-divider py-3 first:border-t-0 last:pb-0">
              <PersonRow
                name={p.fullName}
                href={`/in/${p.slug}`}
                tintKey={p.slug}
                avatarSize={36}
                size="sm"
                title={<TitleOrg title={p.currentTitle ? railTitle(p.currentTitle) : null} org={p.org?.shortName ?? null} />}
                context={
                  <ContextLine icon={Network}>
                    <ViaLine link={l} />
                  </ContextLine>
                }
                // Unclaimed (every real coach today): Connect opens the invite dialog, never a fake pending request.
                action={<PersonRowAction person={p} />}
              />
            </li>
          );
        })}
      </ul>
      {explainInferred && sameTreeInferred(links) && (
        <p className="mt-3 border-t border-divider pt-3 text-caption text-fg-3">
          <InferredKey />
        </p>
      )}
    </SectionCard>
  );
}

/**
 * Rail: People also viewed (§8.4): head coaches in the same conference (there is no view data yet,
 * so the subtitle says what the list is, and the rows don't repeat the conference). Whole row is the
 * link. Dropped on phone.
 */
export function AlsoViewedCard({ people, conferenceAbbr }: { people: PersonSummary[]; conferenceAbbr: string }) {
  if (!people.length) return null;
  const conf = conferenceShort(conferenceAbbr) ?? conferenceAbbr;
  return (
    <SectionCard id="also-viewed" size="rail" title="People also viewed" subtitle={`Head coaches in the ${conf}`} className="max-md:hidden">
      <ul className="mt-1">
        {people.map((p) => (
          <li key={p.id} className="border-t border-divider py-2 first:border-t-0 last:pb-0">
            <PersonRow
              name={p.fullName}
              href={`/in/${p.slug}`}
              tintKey={p.slug}
              avatarSize={32}
              size="sm"
              linkRow
              // No "· Conf" per row: the subtitle already names the conference.
              title={<TitleOrg title={p.currentTitle ? railTitle(p.currentTitle) : null} org={p.org?.shortName ?? null} />}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/**
 * Breadcrumb (§8.4, md and up): "{Program} › Staff › {Name}". A fictional demo candidate is on no real
 * staff, so its crumb is "Coaches › {Name}", or "Hiring pipeline › {Name}" for the athletic director demo
 * (who arrives from the pipeline).
 */
export function ProfileBreadcrumb({
  name,
  program,
  demo,
}: {
  name: string;
  program: { slug: string; shortName: string; inRegistry: boolean } | null;
  /** Set on a fictional demo candidate: who is looking. */
  demo?: "employer" | "other";
}) {
  const sep = <Icon icon={ChevronRight} size={14} className="text-fg-3" />;
  const link = "inline-flex min-h-6 items-center rounded-xs underline-offset-2 hover:text-fg-1 hover:underline";
  const crumb = (href: string, label: string) => (
    <li className="flex items-center gap-1">
      <Link href={href} className={link}>
        {label}
      </Link>
      {sep}
    </li>
  );
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1 text-small leading-6 text-fg-2">
        {demo === "employer" ? (
          crumb("/employers/pipeline", "Hiring pipeline")
        ) : !demo && program?.inRegistry ? (
          <>
            {crumb(`/programs/${program.slug}`, program.shortName)}
            {crumb(`/programs/${program.slug}?tab=staff`, "Staff")}
          </>
        ) : (
          crumb("/search?type=people", "Coaches")
        )}
        <li className="min-w-0 truncate">
          <span aria-current="page" className="text-fg-1">
            {name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
