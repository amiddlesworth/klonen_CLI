import Link from "next/link";
import { ProgramBadges, DemoLabel } from "@/components/data/Badges";
import { PersonRow } from "@/components/data/PersonRow";
import { UnclaimedChip } from "@/components/ui/Chip";
import { OrgMark } from "@/components/ui/OrgMark";
import { titleShort } from "@/lib/format";
import type { PersonResult, ProgramResult, TreeContext } from "@/lib/queries/searchx";
import { ConnectButton } from "./ConnectButton";
import { FollowButton } from "./FollowButton";
import { plural, stateName } from "./params";
import { TreeContextLine } from "./TreeContextLine";

/**
 * Person result (§8.7): avatar 48, name 15/600 + Unclaimed chip, "{Title} at {Program}" 13 --fg-2,
 * division and conference chips, one ContextLine of tree context, Connect icon button.
 */
export function PersonResultRow({
  person: p,
  context,
  conferenceNames,
  isViewer,
  mentorNamed,
  orgNamed,
}: {
  person: PersonResult;
  context?: TreeContext;
  conferenceNames: Record<string, string>;
  isViewer: boolean;
  /** The page heading names the "Worked under" coach, so context lines use the first name. */
  mentorNamed?: boolean;
  /** The page heading names the "Worked at" program, so context lines leave it out. */
  orgNamed?: boolean;
}) {
  const program = p.org ? (
    p.org.inRegistry ? (
      <Link href={`/programs/${p.org.slug}`} className="font-medium text-fg-1 underline-offset-2 hover:underline">
        {p.org.shortName}
      </Link>
    ) : (
      <span className="font-medium text-fg-1">{p.org.shortName}</span>
    )
  ) : null;
  // Phone rows abbreviate long titles (§6.3 titleShort) so the program stays visible.
  const short = p.currentTitle ? titleShort(p.currentTitle) : null;
  const titleText =
    p.currentTitle && short !== p.currentTitle ? (
      <>
        <span className="md:hidden">{short}</span>
        <span className="max-md:hidden">{p.currentTitle}</span>
      </>
    ) : (
      p.currentTitle
    );
  const title =
    p.currentTitle && program ? (
      <>
        {titleText} at {program}
      </>
    ) : (
      (titleText ?? program)
    );
  return (
    <li className="p-4 [&_a.target-24]:text-subtitle">
      <PersonRow
        name={p.fullName}
        href={`/in/${p.slug}`}
        tintKey={p.slug}
        avatarSize={48}
        title={title}
        truncate={false}
        chips={
          <>
            {!p.claimed && <UnclaimedChip />}
            {p.isDemo && <DemoLabel />}
            {isViewer && <span className="text-caption text-fg-3">You</span>}
          </>
        }
        context={
          <>
            {p.org && (p.org.level || p.org.conference) && (
              <ProgramBadges level={p.org.level} conferenceAbbr={p.org.conference} conference={p.org.conference ? conferenceNames[p.org.conference] : null} className="mt-1.5" />
            )}
            <TreeContextLine ctx={context} firstName={p.firstName} mentorNamed={mentorNamed} orgNamed={orgNamed} />
          </>
        }
        action={isViewer ? undefined : <ConnectButton personId={p.id} slug={p.slug} name={p.fullName} firstName={p.firstName} claimed={p.claimed} />}
      />
    </li>
  );
}

/**
 * Program result (§8.7): OrgMark 48, name 15/600, "{Nickname} · {State}", chips,
 * "12 staff · 3 alumni coaches" 12 --fg-3, Follow icon button.
 */
export function ProgramResultRow({ program: o, conferenceNames }: { program: ProgramResult; conferenceNames: Record<string, string> }) {
  const place = o.city && o.state ? `${o.city}, ${o.state}` : o.state ? stateName(o.state) : null;
  const sub = [o.nickname, place].filter(Boolean).join(" · ");
  return (
    <li className="flex min-w-0 items-start gap-3 p-4">
      <OrgMark shortName={o.shortName} name={o.name} size={48} />
      <div className="min-w-0 flex-1">
        <Link href={`/programs/${o.slug}`} className="target-24 block truncate text-subtitle font-semibold text-fg-1 underline-offset-2 hover:underline">
          {o.name}
        </Link>
        {sub && <p className="truncate text-small text-fg-2">{sub}</p>}
        <ProgramBadges level={o.level} conferenceAbbr={o.conference} conference={o.conference ? conferenceNames[o.conference] : null} className="mt-1.5" />
        <p className="mt-1 text-caption text-fg-3">
          {o.staff > 0 ? <span className="num">{o.staff.toLocaleString("en-US")} staff</span> : "No staff listed"} ·{" "}
          {o.alumni > 0 ? <span className="num">{plural(o.alumni, "alumni coach", "alumni coaches")}</span> : "no alumni coaches yet"}
        </p>
      </div>
      <FollowButton name={o.shortName} />
    </li>
  );
}
