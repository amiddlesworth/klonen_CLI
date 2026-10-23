import { ExternalLink, Users } from "lucide-react";
import { InferredFootnote } from "@/components/data/InferredYear";
import { SeasonRange } from "@/components/data/SeasonRange";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { sourceDomain } from "@/lib/format";
import { STAFF_UNIT_LABEL } from "@/lib/queries/orgs";
import { getProgramStaff, getStaffStints, type ProgramOrg } from "@/lib/queries/program";
import { LedgerPersonRow, LedgerUndated } from "./LedgerPersonRow";
import { displayTitle, evidenceReason, peopleCount } from "./text";

/**
 * Staff tab (§8.6): one card per unit in order Head coach · Offense · Defense · Special teams ·
 * Support; units without staff are hidden. A registry program whose staff page we could not read
 * gets an honest empty state that links to its athletics site.
 */
export async function StaffTab({ org }: { org: ProgramOrg }) {
  const [units, stints] = await Promise.all([getProgramStaff(org.id), getStaffStints(org.id)]);

  if (!units.length) {
    return (
      <Card padding="main" aria-labelledby="staff-empty-title">
        <CardHeader id="staff-empty-title" title="Staff" />
        <EmptyState
          icon={Users}
          title={`No staff listed for ${org.shortName}.`}
          description={
            org.inRegistry
              ? "We couldn't read this program's staff page yet: the site blocked automated access or was unreachable. The current staff is on the athletics site."
              : "Nobody on this page lists it as their current job."
          }
          action={
            org.athleticsUrl ? (
              <ButtonLink href={org.athleticsUrl} iconRight={ExternalLink}>
                {sourceDomain(org.athleticsUrl)}
                <span className="sr-only"> (opens in a new tab)</span>
              </ButtonLink>
            ) : undefined
          }
          spacing="lg"
        />
      </Card>
    );
  }

  const firstInferredUnit = units.find((u) => u.people.some((p) => isInferred(stints.get(p.id))))?.unit;

  return (
    <>
      {units.map(({ unit, people }) => (
        <Card key={unit} padding="main" aria-labelledby={`unit-${unit}`}>
          <CardHeader id={`unit-${unit}`} title={STAFF_UNIT_LABEL[unit]} meta={peopleCount(people.length)} />
          <ul className="divide-y divide-divider">
            {people.map((p) => {
              const s = stints.get(p.id);
              return (
                <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <LedgerPersonRow
                    person={p}
                    line={displayTitle(p.currentTitle)}
                    ledger={
                      s?.startYear ? (
                        <SeasonRange startYear={s.startYear} endYear={null} isCurrent inferred={!s.yearsExplicit} inferredReason={evidenceReason(s.evidence)} />
                      ) : (
                        <LedgerUndated />
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
          {unit === firstInferredUnit && <InferredFootnote className="mt-3">Dotted years are inferred from the staff bio, not stated in it.</InferredFootnote>}
        </Card>
      ))}
    </>
  );
}

function isInferred(s: { startYear: number | null; yearsExplicit: boolean } | undefined) {
  return !!s?.startYear && !s.yearsExplicit;
}
