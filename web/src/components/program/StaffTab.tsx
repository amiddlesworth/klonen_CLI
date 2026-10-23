import { ExternalLink, Users } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredFootnote, InferredYear } from "@/components/data/InferredYear";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { sourceDomain } from "@/lib/format";
import { PROGRAM_STAFF_UNIT_LABEL, getProgramStaff, getStaffStints, staffLedger, type RangeYear, type StaffLedger, type ProgramOrg } from "@/lib/queries/program";
import { LedgerPersonRow, LedgerUndated } from "./LedgerPersonRow";
import { LedgerRange, RangeRuns } from "./LedgerRange";
import { displayTitle, evidenceReason, peopleCount } from "./text";

function Year({ year }: { year: RangeYear }) {
  return (
    <span className="num whitespace-nowrap">
      {year.inferred ? <InferredYear reason={evidenceReason(year.evidence)}>{year.text}</InferredYear> : year.text}
    </span>
  );
}

const earlierRoles = (n: number) => `${n} earlier ${n === 1 ? "role" : "roles"} here`;

/**
 * The second line of a staff row (12/16 --fg-3), only when time at the program says more than the
 * current role's range in the ledger: "At Pacific (OR) since 2010 · 1 earlier role here",
 * "At Allegheny 2017–2018, 2023–Present · 1 earlier role here", "First at Marietta in 2017 · 1 earlier
 * role here", or "Also held 2 earlier roles here". The "·" is glued to the word before it, so a wrapped
 * line never starts with punctuation; years never break.
 */
function TenureLine({ ledger, shortName }: { ledger: StaffLedger; shortName: string }) {
  const { tenure, earlierRoles: n } = ledger;
  if (!tenure && !n) return null;
  if (!tenure) return <ContextLine>Also held {earlierRoles(n)}</ContextLine>;
  return (
    <ContextLine>
      {tenure.kind === "since" ? (
        <>
          At {shortName} since <Year year={tenure.year} />
        </>
      ) : tenure.kind === "first" ? (
        <>
          First at {shortName} in <Year year={tenure.year} />
        </>
      ) : (
        <>
          At {shortName}{" "}
          <span className="tabular-nums">
            <RangeRuns pieces={tenure.pieces} />
          </span>
        </>
      )}
      {n > 0 && (
        <>
          {" ·"} <span className="whitespace-nowrap">{earlierRoles(n)}</span>
        </>
      )}
    </ContextLine>
  );
}

/**
 * Staff tab (§8.6): one card per unit in order Head coach · Offense · Defense · Special teams ·
 * Assistant coaches · Support staff; units without staff are hidden. The ledger shows the current
 * role's range ("2020–Present · 7 seasons", or "Start year not in source"); time at the program and
 * earlier roles here go in a second line when they differ. A registry program whose staff page we could
 * not read gets an honest empty state that links to the staff on its athletics site.
 */
export async function StaffTab({ org, viewerPersonId }: { org: ProgramOrg; viewerPersonId?: string | null }) {
  const [units, stints] = await Promise.all([getProgramStaff(org.id), getStaffStints(org.id)]);

  if (!units.length) {
    const domain = org.athleticsUrl ? sourceDomain(org.athleticsUrl) : null;
    return (
      <Card padding="main" aria-labelledby="staff-empty-title">
        <CardHeader id="staff-empty-title" title="Staff" />
        <EmptyState
          icon={Users}
          title={`No staff listed for ${org.shortName}.`}
          description={org.inRegistry ? "We couldn't read this program's staff page yet." : "Nobody on this page lists it as their current job."}
          action={
            org.athleticsUrl && domain ? (
              <ButtonLink href={org.athleticsUrl} iconRight={ExternalLink} phone="large">
                View staff on {domain}
                <span className="sr-only"> (opens in a new tab)</span>
              </ButtonLink>
            ) : undefined
          }
          spacing="lg"
        />
      </Card>
    );
  }

  const ledgers = new Map(units.flatMap((u) => u.people.map((p) => [p.id, staffLedger(stints.get(p.id) ?? [])] as const)));
  const firstInferredUnit = units.find((u) => u.people.some((p) => ledgers.get(p.id)?.inferred))?.unit;

  return (
    <>
      {units.map(({ unit, people }) => (
        <Card key={unit} padding="main" aria-labelledby={`unit-${unit}`}>
          <CardHeader id={`unit-${unit}`} title={PROGRAM_STAFF_UNIT_LABEL[unit]} meta={peopleCount(people.length)} />
          <ul className="divide-y divide-divider">
            {people.map((p) => {
              const ledger = ledgers.get(p.id)!;
              const dated = ledger.current.some((x) => x.startYear);
              return (
                <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <LedgerPersonRow
                    person={p}
                    isViewer={!!viewerPersonId && p.id === viewerPersonId}
                    line={displayTitle(p.currentTitle)}
                    context={<TenureLine ledger={ledger} shortName={org.shortName} />}
                    ledger={dated ? <LedgerRange stints={ledger.current} /> : <LedgerUndated />}
                  />
                </li>
              );
            })}
          </ul>
          {unit === firstInferredUnit && <InferredFootnote className="mt-3" />}
        </Card>
      ))}
    </>
  );
}
