import { ExternalLink, Users } from "lucide-react";
import { InferredFootnote } from "@/components/data/InferredYear";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { sourceDomain } from "@/lib/format";
import { PROGRAM_STAFF_UNIT_LABEL, getProgramStaff, getStaffStints, type ProgramOrg } from "@/lib/queries/program";
import { LedgerPersonRow, LedgerUndated } from "./LedgerPersonRow";
import { LedgerRange, rangeHasInferred } from "./LedgerRange";
import { displayTitle, peopleCount } from "./text";

/**
 * Staff tab (§8.6): one card per unit in order Head coach · Offense · Defense · Special teams ·
 * Assistant coaches · Support staff; units without staff are hidden. The ledger shows each person's
 * time at the program across all their roles here. A registry program whose staff page we could not
 * read gets an honest empty state that links to the staff on its athletics site.
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

  const firstInferredUnit = units.find((u) => u.people.some((p) => rangeHasInferred(stints.get(p.id) ?? [])))?.unit;

  return (
    <>
      {units.map(({ unit, people }) => (
        <Card key={unit} padding="main" aria-labelledby={`unit-${unit}`}>
          <CardHeader id={`unit-${unit}`} title={PROGRAM_STAFF_UNIT_LABEL[unit]} meta={peopleCount(people.length)} />
          <ul className="divide-y divide-divider">
            {people.map((p) => {
              const s = stints.get(p.id);
              const dated = !!s?.some((x) => x.startYear);
              return (
                <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <LedgerPersonRow
                    person={p}
                    isViewer={!!viewerPersonId && p.id === viewerPersonId}
                    line={displayTitle(p.currentTitle)}
                    ledger={
                      s && dated ? (
                        <LedgerRange stints={s} />
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
