import Link from "next/link";
import { InferredYear } from "@/components/data/InferredYear";
import { seasonRange } from "@/lib/format";
import type { FeedMove, PriorStint } from "@/lib/queries/feedx";
import { apNumber, apTitle, atOrg, endsInParen, isStaffOnly, joinAnd, orgListName, playedAt, recordTitle, type OrgRef } from "./text";

/** The organization of a past stint, for the prose helpers in text.ts. */
export function orgOf(p: Pick<PriorStint, "orgId" | "orgShortName" | "orgLevel">): OrgRef {
  return { id: p.orgId, shortName: p.orgShortName, level: p.orgLevel };
}

const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A past stint's years in running text ("2022–2024"), dotted with its reason when inferred. Null when undated. */
export function StintYears({ stint }: { stint: Pick<PriorStint, "startYear" | "endYear" | "inferred" | "inferredReason"> }) {
  if (!stint.startYear) return null;
  const { range } = seasonRange(stint.startYear, stint.endYear, false);
  return <span className="num whitespace-nowrap">{stint.inferred ? <InferredYear reason={stint.inferredReason}>{range}</InferredYear> : range}</span>;
}

/** "Previously offensive coordinator at St. John Fisher, 2022–2024" / "Played at George Fox, 2022–2025" (grouped hires). */
export function PreviouslyLine({ move }: { move: FeedMove }) {
  const p = move.previous;
  if (!p) return null;
  const years = p.startYear ? (
    <>
      , <StintYears stint={p} />
    </>
  ) : null;
  if (p.asPlayer) {
    return (
      <>
        {upperFirst(playedAt(orgOf(p)))}
        {years}
      </>
    );
  }
  return (
    <>
      Previously {pastRole(p)} {atOrg(orgOf(p))}
      {years}
    </>
  );
}

/** A past role in a sentence: "offensive coordinator", or "on the coaching staff" for staff-only titles. */
export function pastRole(p: Pick<PriorStint, "role">): string {
  return isStaffOnly(p.role) ? `on the ${apTitle(p.role).replace(/ member$/, "")}` : apTitle(p.role);
}

/**
 * The stint behind a "coached at your program" reason, as one facts line: "Defensive line coach at
 * Pacific (OR), 2015–2018" or "Assistant coach at Pacific (OR) · years not in source".
 */
export function FormerStaffFacts({ stint }: { stint: PriorStint }) {
  return (
    <>
      {recordTitle(stint.role)} {atOrg(orgOf(stint))}
      {stint.startYear ? (
        <>
          , <StintYears stint={stint} />
        </>
      ) : (
        <span className="text-fg-3"> · years not in source</span>
      )}
    </>
  );
}

/** Programs named in an undated facts line before "and N other programs". */
const NAMED = 2;

/**
 * Earlier stints the source gives no years for (§8.3: they stay out of the dated move record), as
 * one facts line in the order the bio lists them: "Previously defensive coordinator at Mount Union ·
 * years not in source" (an earlier role at this program) or "Previously at Eastern New Mexico,
 * La Verne and 6 other programs · years not in source".
 */
export function UndatedLine({ stints, orgId }: { stints: PriorStint[]; /** The new role's program. */ orgId: string }) {
  if (!stints.length) return null;
  const here = stints.filter((s) => s.orgId === orgId && !s.asPlayer);
  const seen = new Set<string>([orgId]);
  const elsewhere = stints.filter((s) => {
    if (seen.has(s.orgId) || s.asPlayer) return false;
    seen.add(s.orgId);
    return true;
  });
  const played = !here.length && !elsewhere.length ? stints.find((s) => s.asPlayer) : undefined;

  const parts: string[] = [];
  if (here.length) parts.push(`${joinAnd([...new Set(here.map(pastRole))].slice(0, 2))} ${atOrg(orgOf(here[0]))}`);
  if (elsewhere.length) {
    const names = elsewhere.slice(0, NAMED).map((s) => orgListName(orgOf(s)));
    const more = elsewhere.length - names.length;
    const list = more > 0 ? `${names.join(", ")} and ${apNumber(more)} other ${more === 1 ? "program" : "programs"}` : joinAnd(names);
    parts.push(here.length ? `also at ${list}` : `at ${list}`);
  }
  const text = played ? upperFirst(playedAt(orgOf(played))) : `Previously ${parts.join("; ")}`;
  return (
    <>
      {text}
      <span className="text-fg-3"> · years not in source</span>
    </>
  );
}

const PersonName = ({ move }: { move: FeedMove }) => (
  <Link href={`/in/${move.person.slug}`} className="font-semibold underline-offset-2 hover:underline">
    {move.person.fullName}
  </Link>
);

/**
 * The years after a past stint in a digest sentence: " (2022–2024)" glued to the word before, or
 * " in 2022–2024" after a name that already ends in parentheses ("St. Thomas (Minnesota)"), so they
 * never stack. Nothing when undated.
 */
function Years({ stint, afterName }: { stint: PriorStint; /** The text the years follow, when it is the program's name. */ afterName?: string }) {
  if (!stint.startYear) return null;
  if (afterName && endsInParen(afterName)) {
    return (
      <>
        {" in "}
        <StintYears stint={stint} />
      </>
    );
  }
  return (
    <>
      {" "}(<StintYears stint={stint} />)
    </>
  );
}

/**
 * One AP sentence for the transactions digest (§8.5), the program being the row's subject:
 * "Named Adrian Saterstad offensive line coach; previously assistant defensive line coach at Michigan Tech (2025)."
 * Returns: "Brought back Steve Brown as assistant coach; previously assistant coach there (2015–2018)."
 * Promotions and other new roles name the earlier role at the program.
 */
export function DigestSentence({ move }: { move: FeedMove }) {
  const name = <PersonName move={move} />;
  const p = move.previous;
  const title = apTitle(move.role);
  switch (move.kind) {
    case "promoted":
      return (
        <>
          Promoted {name} to {title}
          {p ? <>; previously {pastRole(p)}</> : null}.
        </>
      );
    case "moved":
      return (
        <>
          Moved {name} to {title}
          {p ? <>; previously {pastRole(p)}</> : null}.
        </>
      );
    case "returned":
      return (
        <>
          Brought back {name} as {title}
          {p ? (
            <>
              ; previously {pastRole(p)} there
              <Years stint={p} />
            </>
          ) : null}
          .
        </>
      );
    default:
      if (!p)
        return (
          <>
            Named {name} {title}.
          </>
        );
      if (p.asPlayer)
        return (
          <>
            Named {name} {title}; {playedAt(orgOf(p))}
            <Years stint={p} afterName={p.orgShortName} />.
          </>
        );
      return (
        <>
          Named {name} {title}; previously {pastRole(p)} {atOrg(orgOf(p))}
          <Years stint={p} afterName={p.orgShortName} />.
        </>
      );
  }
}
