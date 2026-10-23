import { Building2, GraduationCap, Info, Network, Users, type LucideIcon } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { PersonRow } from "@/components/data/PersonRow";
import { InviteToClaimButton, PersonRowAction } from "@/components/data/PersonRowAction";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { titleShort } from "@/lib/format";
import type { PymkRow } from "@/lib/queries/feedx";
import { firstNameOf } from "./text";

const CONTEXT_ICON: Record<PymkRow["contextKind"], LucideIcon> = { tree: Network, school: GraduationCap, info: Info, conference: Building2 };

/**
 * People you may know (§8.5): up to 3 rows (avatar 36, name, title · program, a context line with
 * the reason, Connect). An unclaimed coach the viewer already knows gets "Invite to claim" instead; any
 * other unclaimed coach's Connect opens the same invite dialog (PersonRowAction).
 */
export function PeopleYouMayKnow({ rows }: { rows: PymkRow[] }) {
  return (
    <Card padding="rail" aria-labelledby="pymk-title">
      <h2 id="pymk-title" className="text-body font-semibold">
        People you may know
      </h2>
      <p className="mt-0.5 text-caption text-fg-3">Through your staff and schools</p>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No suggestions yet." description="They show up as coaches you worked with are added." spacing="sm" align="start" />
      ) : (
        <ul className="mt-1">
          {rows.map((r) => {
            // The labelled invite only where the reason line says the profile hasn't been claimed (§8.5).
            const invite = r.known && !r.claimed;
            const person = { id: r.id, slug: r.slug, fullName: r.fullName, firstName: firstNameOf(r.fullName), claimed: r.claimed };
            return (
              <li key={r.id} className="border-t border-divider py-3 first:border-t-0 last:pb-0">
                <PersonRow
                  // Name links get the full 24px target (§8.1 Link): inline-block so the padding counts.
                  className="[&_a.target-24]:inline-block [&_a.target-24]:max-w-full [&_a.target-24]:truncate [&_a.target-24]:align-top"
                  name={r.fullName}
                  href={`/in/${r.slug}`}
                  tintKey={r.slug}
                  title={r.title ? titleShort(r.title) : null}
                  org={r.orgShortName}
                  avatarSize={36}
                  size="sm"
                  context={<ContextLine icon={CONTEXT_ICON[r.contextKind]}>{r.context}</ContextLine>}
                  action={invite ? undefined : <PersonRowAction person={person} />}
                  footer={invite ? <InviteToClaimButton person={person} /> : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
