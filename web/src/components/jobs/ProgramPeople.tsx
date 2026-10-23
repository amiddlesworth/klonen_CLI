import { Network, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { SampleChip, UnclaimedChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { PersonRow } from "@/components/data/PersonRow";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { titleShort } from "@/lib/format";
import type { JobOrg, NetworkProof } from "@/lib/queries/jobsx";
import type { PersonSummary } from "@/lib/queries/people";
import type { JobProof } from "./JobCard";

function nameList(names: string[], total: number): string {
  const extra = total - names.length;
  if (names.length === 1) return extra > 0 ? `${names[0]} and ${extra} other${extra === 1 ? "" : "s"}` : names[0];
  if (extra > 0) return `${names.join(", ")} and ${extra} other${extra === 1 ? "" : "s"}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * "Your network here" (§8.9): people from the viewer's coaching tree who coached or played at the
 * program, as avatars plus one sentence. Neutral wording; no pronouns.
 */
export function proofFor(np: NetworkProof | null, programShort: string): JobProof | null {
  if (!np || !np.people.length) return null;
  const names = np.people.map((p) => p.fullName);
  const allPlayers = np.people.every((p) => p.asPlayer);
  const verb = allPlayers ? "played" : "coached";
  const who = nameList(names, np.total);
  return {
    people: np.people.map((p) => ({ name: p.fullName, slug: p.slug })),
    sentence: `${who} from your coaching tree ${verb} at ${programShort}`,
  };
}

type ProgramPeopleProps = {
  org: JobOrg;
  people: PersonSummary[];
  total: number;
  proof?: JobProof | null;
  /** "card": its own main-column card (job page); "section": inside the /jobs detail pane. */
  as?: "card" | "section";
};

/** "People from this program on the network": the program's current staff, up to six, as linked rows. */
export function ProgramPeople({ org, people, total, proof, as = "card" }: ProgramPeopleProps) {
  const headingId = as === "card" ? "job-people-title" : "pane-people-title";
  const staffHref = org.inRegistry ? `/programs/${org.slug}?tab=staff` : null;
  const body = (
    <>
      {proof && (
        <div className="mb-3 flex items-center gap-2 border-b border-divider pb-3 text-small text-fg-2">
          <span className="flex shrink-0 gap-1">
            {proof.people.map((p) => (
              <Avatar key={p.slug} name={p.name} tintKey={p.slug} size={24} />
            ))}
          </span>
          <span className="flex min-w-0 items-start gap-1">
            <Icon icon={Network} size={12} className="mt-1 text-fg-2" />
            <span>{proof.sentence}</span>
          </span>
        </div>
      )}
      {people.length ? (
        <ul className={cn("grid gap-x-6", as === "card" ? "md:grid-cols-2" : "grid-cols-2")}>
          {people.map((p) => (
            <li
              key={p.id}
              className={cn(
                "min-w-0 border-t border-divider py-2.5 first:border-t-0 first:pt-0",
                as === "card" ? "md:[&:nth-child(2)]:border-t-0 md:[&:nth-child(2)]:pt-0" : "[&:nth-child(2)]:border-t-0 [&:nth-child(2)]:pt-0",
              )}
            >
              <PersonRow
                name={p.fullName}
                href={`/in/${p.slug}`}
                tintKey={p.slug}
                avatarSize={40}
                title={p.currentTitle ? titleShort(p.currentTitle) : null}
                chips={p.isDemo ? <SampleChip label="Demo" /> : !p.claimed ? <UnclaimedChip /> : null}
                linkRow
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Users}
          spacing="sm"
          title={`No one from ${org.shortName} is on ${BRAND.name} yet.`}
          description="Staff appear here once we can read the program's staff page."
        />
      )}
      {staffHref && total > people.length && (
        <CardFooter>
          <TextLink href={staffHref} arrow className="target-24 text-small">
            View all {total} staff
          </TextLink>
        </CardFooter>
      )}
    </>
  );

  if (as === "section") {
    return (
      <section aria-labelledby={headingId}>
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
          <h3 id={headingId} className="grow text-body font-semibold">
            People from this program on the network
          </h3>
          {total > 0 && <span className="num text-small text-fg-3">{total === 1 ? "1 person" : `${total} people`}</span>}
        </div>
        {body}
      </section>
    );
  }
  return (
    <Card padding="main" aria-labelledby={headingId}>
      <CardHeader id={headingId} title="People from this program on the network" meta={total > 0 ? (total === 1 ? "1 person" : `${total} people`) : undefined} />
      {body}
    </Card>
  );
}
