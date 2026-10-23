import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Network, Users } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredFootnote, InferredYear } from "@/components/data/InferredYear";
import { PersonRow } from "@/components/data/PersonRow";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardHeader } from "@/components/ui/Card";
import { SampleChip, UnclaimedChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { seasonRangeMulti, titleShort } from "@/lib/format";
import type { JobOrg, NetworkProof, ProgramAlumnus, ProgramNetwork } from "@/lib/queries/jobsx";
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
 * program, as avatars plus one sentence, closest ties first (getNetworkProof). On the viewer's own
 * program (from the session) it leads with the program as "your program" and names the head coach
 * as "your head coach" (§8.3 ContextStrip patterns). Neutral wording; no pronouns.
 */
export function proofFor(np: NetworkProof | null, programShort: string, opts: { ownProgram?: boolean } = {}): JobProof | null {
  if (!np || !np.people.length) return null;
  const people = [...np.people];
  if (opts.ownProgram) {
    const hc = people.findIndex((p) => p.headCoachHere);
    if (hc > 0) people.unshift(...people.splice(hc, 1));
  }
  // The verb covers everyone counted, not just the people named.
  const verb = np.playersOnly === np.total ? "played" : np.playersOnly > 0 ? "coached or played" : "coached";
  const avatars = people.map((p) => ({ name: p.fullName, slug: p.slug }));

  if (opts.ownProgram) {
    const strip = { subject: programShort, reason: "your program" };
    const lead = people[0];
    if (lead.headCoachHere) {
      const others = np.total - 1;
      return {
        people: avatars,
        strip,
        sentence: others > 0 ? `${lead.fullName}, your head coach, and ${others} other${others === 1 ? "" : "s"} from your coaching tree have ${verb} here` : `${lead.fullName} · your head coach`,
      };
    }
    return { people: avatars, strip, sentence: `${nameList(people.map((p) => p.fullName), np.total)} from your coaching tree have ${verb} here` };
  }
  return { people: avatars, sentence: `${nameList(people.map((p) => p.fullName), np.total)} from your coaching tree ${verb} at ${programShort}` };
}

/** "Now Offensive Coordinator at St. Olaf": the person's current job, titles shortened for the row (§6.3). */
function nowLine(p: PersonSummary): string | null {
  const raw = p.currentTitle?.replace(/\s*\(\s*\d{4}\s*[-–]\s*(?:\d{2,4})?\s*\)\s*$/, "").trim() || null;
  const title = raw && !/^(?:class of\s+)?\d{4}$/i.test(raw) && !/['’‘]\s*\d{2}\s*$/.test(raw) ? titleShort(raw) : null;
  const org = p.org?.shortName ?? null;
  if (title && org) return `Now ${title} at ${org}`;
  if (org) return `Now at ${org}`;
  return title ? `Now ${title}` : null;
}

/** Tooltip reason for an inferred range (§6.2), quoting the source sentence where we have it. */
function inferredReason(evidence: string | null): string {
  const text = evidence?.trim().replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "");
  if (!text) return "the year is not stated in the bio";
  const clipped = text.length > 140 ? `${text.slice(0, 140).replace(/\s+\S*$/, "")}…` : text;
  return `the bio does not state the year (“${clipped}”)`;
}

function PersonChips({ person }: { person: { isDemo: boolean; claimed: boolean } }) {
  return person.isDemo ? <SampleChip label="Demo" /> : !person.claimed ? <UnclaimedChip /> : null;
}

/**
 * Someone who coached or played here: avatar 40, name, "{role here} · {seasons here}" (the range
 * never truncates; the role does) and a "Now {title} at {program}" context line. The row is one link.
 */
function AlumnusRow({ entry }: { entry: ProgramAlumnus }) {
  const { person } = entry;
  const dated = entry.stints.some((s) => s.startYear);
  const range = dated ? seasonRangeMulti(entry.stints).range : null;
  const now = nowLine(person);
  return (
    <Link href={`/in/${person.slug}`} className="group/row flex min-h-11 min-w-0 items-start gap-3 rounded-xs">
      <Avatar name={person.fullName} tintKey={person.slug} size={40} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{person.fullName}</span>
          <PersonChips person={person} />
        </span>
        <span className="flex min-w-0 text-small text-fg-2">
          <span className="min-w-0 truncate">{titleShort(entry.role)}</span>
          {range && (
            <span className="num shrink-0 whitespace-pre">
              {" · "}
              {entry.inferred ? <InferredYear reason={inferredReason(entry.inferredEvidence)}>{range}</InferredYear> : range}
            </span>
          )}
        </span>
        {now && <ContextLine>{now}</ContextLine>}
      </span>
    </Link>
  );
}

function Group({
  id,
  title,
  count,
  note,
  heading,
  columns,
  footer,
  children,
}: {
  id: string;
  title: string;
  count: number;
  note?: string;
  heading: "h3" | "h4";
  columns: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const H = heading;
  return (
    <section aria-labelledby={id} className="min-w-0">
      <H id={id} className="text-small font-semibold text-fg-1">
        {title} <span className="num font-normal text-fg-3">{count}</span>
      </H>
      {note && <p className="text-caption text-fg-3">{note}</p>}
      <ul className={cn("mt-2 grid gap-x-6", columns)}>{children}</ul>
      {footer && <div className="mt-2">{footer}</div>}
    </section>
  );
}

/** Rows split by dividers; in two columns the first row of each column has no top rule. */
function rowCls(twoUp: string) {
  return cn("min-w-0 border-t border-divider py-2.5 first:border-t-0 first:pt-0", twoUp);
}

type ProgramPeopleProps = {
  org: JobOrg;
  network: ProgramNetwork;
  proof?: JobProof | null;
  /** "card": its own main-column card (job page); "section": inside the /jobs detail pane. */
  as?: "card" | "section";
};

/**
 * "People from this program on the network": who a coach could call about this staff. Three
 * groups, each with its count: Current staff (head coach and coordinators first), Alumni coaches
 * (coached here before their current job) and Played here (former players who now coach), the
 * last two built like the program page's Alumni coaches tab so the counts match it. A program
 * with no staff listed still shows its alumni; "No one from {program} is on the network" is said
 * only when nobody at all has a stint there.
 */
export function ProgramPeople({ org, network, proof, as = "card" }: ProgramPeopleProps) {
  const prefix = as === "card" ? "job-people" : "pane-people";
  const headingId = `${prefix}-title`;
  const groupHeading = as === "card" ? "h3" : "h4";
  const columns = as === "card" ? "md:grid-cols-2" : "grid-cols-2";
  const twoUp = as === "card" ? "md:[&:nth-child(2)]:border-t-0 md:[&:nth-child(2)]:pt-0" : "[&:nth-child(2)]:border-t-0 [&:nth-child(2)]:pt-0";
  const programHref = org.inRegistry ? `/programs/${org.slug}` : null;
  const { staff, staffTotal, viewerOnStaff, alumni, alumniTotal, players, playersTotal } = network;
  const anyone = staffTotal + alumniTotal + playersTotal > 0 || viewerOnStaff;
  const showFootnote = [...alumni, ...players].some((e) => e.inferred && e.stints.some((s) => s.startYear));

  const body = (
    <>
      {proof && (
        <div className="mb-4 border-b border-divider pb-3">
          {proof.strip && (
            <p className="mb-2 flex items-center gap-1 text-caption text-fg-2">
              <Icon icon={Building2} size={12} className="text-fg-2" />
              <span className="font-semibold text-fg-1">{proof.strip.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{proof.strip.reason}</span>
            </p>
          )}
          <div className="flex items-center gap-2 text-small text-fg-2">
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
        </div>
      )}
      {!anyone ? (
        <EmptyState
          icon={Users}
          spacing="sm"
          title={`No one from ${org.shortName} is on ${BRAND.name} yet.`}
          description="Coaches appear here once a staff page or a coach's bio names the program."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {staffTotal > 0 ? (
            <Group
              id={`${prefix}-staff`}
              heading={groupHeading}
              title="Current staff"
              count={staffTotal}
              note={viewerOnStaff ? "Not counting you." : undefined}
              columns={columns}
              footer={
                programHref && staffTotal > staff.length ? (
                  <TextLink href={`${programHref}?tab=staff`} arrow target24 className="text-small">
                    {/* The staff tab lists the viewer too, so no count here when the viewer is left out. */}
                    {viewerOnStaff ? "View the full staff" : `View all ${staffTotal} staff`}
                  </TextLink>
                ) : undefined
              }
            >
              {staff.map((p) => (
                <li key={p.id} className={rowCls(twoUp)}>
                  <PersonRow
                    name={p.fullName}
                    href={`/in/${p.slug}`}
                    tintKey={p.slug}
                    avatarSize={40}
                    title={p.currentTitle ? titleShort(p.currentTitle) : null}
                    chips={<PersonChips person={p} />}
                    linkRow
                  />
                </li>
              ))}
            </Group>
          ) : (
            !viewerOnStaff && <p className="text-small text-fg-3">No current staff listed for {org.shortName} yet.</p>
          )}
          {alumniTotal > 0 && (
            <Group
              id={`${prefix}-alumni`}
              heading={groupHeading}
              title="Alumni coaches"
              count={alumniTotal}
              columns={columns}
              footer={
                programHref && alumniTotal > alumni.length ? (
                  <TextLink href={`${programHref}?tab=alumni`} arrow target24 className="text-small">
                    View all {alumniTotal} alumni coaches
                  </TextLink>
                ) : undefined
              }
            >
              {alumni.map((e) => (
                <li key={e.person.id} className={rowCls(twoUp)}>
                  <AlumnusRow entry={e} />
                </li>
              ))}
            </Group>
          )}
          {playersTotal > 0 && (
            <Group
              id={`${prefix}-players`}
              heading={groupHeading}
              title="Played here"
              count={playersTotal}
              columns={columns}
              footer={
                programHref && playersTotal > players.length ? (
                  <TextLink href={`${programHref}?tab=alumni#played`} arrow target24 className="text-small">
                    View all {playersTotal} who played here
                  </TextLink>
                ) : undefined
              }
            >
              {players.map((e) => (
                <li key={e.person.id} className={rowCls(twoUp)}>
                  <AlumnusRow entry={e} />
                </li>
              ))}
            </Group>
          )}
        </div>
      )}
      {showFootnote && <InferredFootnote className="mt-4">Dotted years are inferred from the coach&apos;s bio, not stated in it.</InferredFootnote>}
    </>
  );

  if (as === "section") {
    return (
      <section aria-labelledby={headingId}>
        <h3 id={headingId} className="mb-3 text-body font-semibold">
          People from this program on the network
        </h3>
        {body}
      </section>
    );
  }
  return (
    <Card padding="main" aria-labelledby={headingId}>
      <CardHeader id={headingId} title="People from this program on the network" />
      {body}
    </Card>
  );
}
