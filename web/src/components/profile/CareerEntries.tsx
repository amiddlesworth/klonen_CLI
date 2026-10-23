import { InferredKey } from "@/components/data/InferredYear";
import { ProgramBadges } from "@/components/data/Badges";
import { SectionCard } from "@/components/data/SectionCard";
import { SourceDisclosure } from "@/components/data/SourceDisclosure";
import { OrgMark } from "@/components/ui/OrgMark";
import type { AlmaMaterOrg } from "@/lib/queries/profile";
import { LedgerRange, dottedYear } from "./LedgerRange";
import { OrgName } from "./ExperienceCard";
import { inferredReason, playingLine, spanText, stateName, type SportRow } from "./model";

/** The first year Playing career shows dotted (the Experience legend's sample when Experience has none), or null. */
export function playingDottedYear(rows: SportRow[]): number | null {
  for (const r of rows) {
    const text = spanText(r);
    const y = dottedYear(text, !r.yearsExplicit && !text.undated);
    if (y != null) return y;
  }
  return null;
}

/**
 * Playing career (§8.4): stints with asPlayer only, in the group-header layout (tile, school +
 * chips, position line, range dotted when inferred). A stint in another sport names it ("Baseball ·
 * Player (catcher)"). Hidden when empty.
 */
export function PlayingCard({ rows, personName, explainInferred }: { rows: SportRow[]; personName: string; explainInferred: boolean }) {
  if (!rows.length) return null;
  return (
    <SectionCard id="playing" title="Playing career">
      <ul>
        {rows.map((r) => {
          const text = spanText(r);
          const inferred = !r.yearsExplicit && !text.undated;
          return (
            <li key={r.id} className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 border-t border-divider py-4 first:border-t-0 first:pt-0 last:pb-0">
              <OrgMark shortName={r.org.shortName} name={r.org.name} size={40} />
              <div className="min-w-0">
                <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-start md:justify-between md:gap-4">
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body font-semibold">
                      <OrgName org={r.org} />
                      <ProgramBadges level={r.org.level} conferenceAbbr={r.org.conferenceAbbr} conference={r.org.conference} />
                    </h3>
                    <p className="mt-0.5 text-small text-fg-2">{playingLine(r)}</p>
                  </div>
                  <LedgerRange text={text} inferred={inferred} reason={inferredReason(r.evidence)} className="md:max-w-[60%]" />
                </div>
                <SourceDisclosure evidence={r.evidence} sourceUrl={r.sourceUrl} sourceDetail={`${personName} bio`} className="mt-0.5" />
              </div>
            </li>
          );
        })}
      </ul>
      {/* Only when there is no Experience list: otherwise its legend explains these years too. */}
      {explainInferred && playingDottedYear(rows) != null && (
        <p className="mt-3 border-t border-divider pt-3 text-caption text-fg-3">
          <InferredKey year={playingDottedYear(rows)} />
        </p>
      )}
    </SectionCard>
  );
}

/**
 * Education (§8.4) from the alma mater in the source: only what is known (the school, and its
 * chips when it matches a program). No degree or year is shown unless the source has one.
 */
export function EducationCard({ almaMater, org }: { almaMater: string | null; org: AlmaMaterOrg | null }) {
  const name = almaMater?.trim();
  if (!name) return null;
  const place = stateName(org?.state);
  return (
    <SectionCard id="education" title="Education">
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3">
        <OrgMark shortName={org?.shortName ?? name} name={org?.name ?? name} size={40} />
        <div className="min-w-0 self-center">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body font-semibold">
            {org ? <OrgName org={{ ...org, name: org.name }} /> : <span>{name}</span>}
            {org && <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} />}
          </h3>
          {place && <p className="mt-0.5 text-small text-fg-2">{place}</p>}
        </div>
      </div>
    </SectionCard>
  );
}
