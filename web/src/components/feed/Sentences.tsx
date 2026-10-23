import Link from "next/link";
import { InferredYear } from "@/components/data/InferredYear";
import { seasonRange } from "@/lib/format";
import type { FeedMove, PriorStint } from "@/lib/queries/feedx";
import { apTitle } from "./text";

/** A past stint's years in running text ("2022–2024"), dotted when inferred. Null when undated. */
export function StintYears({ stint }: { stint: Pick<PriorStint, "startYear" | "endYear" | "inferred"> }) {
  if (!stint.startYear) return null;
  const { range } = seasonRange(stint.startYear, stint.endYear, false);
  return <span className="num">{stint.inferred ? <InferredYear>{range}</InferredYear> : range}</span>;
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
        Played at {p.orgShortName}
        {years}
      </>
    );
  }
  return (
    <>
      Previously {apTitle(p.role)} at {p.orgShortName}
      {years}
    </>
  );
}

/**
 * One AP sentence for the transactions digest (§8.5), the program being the row's subject:
 * "Named Adrian Saterstad offensive line coach; previously assistant defensive line coach at Michigan Tech (2025)."
 */
export function DigestSentence({ move }: { move: FeedMove }) {
  const name = (
    <Link href={`/in/${move.person.slug}`} className="font-semibold underline-offset-2 hover:underline">
      {move.person.fullName}
    </Link>
  );
  const p = move.previous;
  const years = p?.startYear ? (
    <>
      {" "}
      (<StintYears stint={p} />)
    </>
  ) : null;
  if (move.kind === "promoted") {
    return (
      <>
        Promoted {name} to {apTitle(move.role)}
        {p && !p.asPlayer ? <>; previously {apTitle(p.role)}</> : null}.
      </>
    );
  }
  if (!p) {
    return (
      <>
        Named {name} {apTitle(move.role)}.
      </>
    );
  }
  if (p.asPlayer) {
    return (
      <>
        Named {name} {apTitle(move.role)}; played at {p.orgShortName}
        {years}.
      </>
    );
  }
  return (
    <>
      Named {name} {apTitle(move.role)}; previously {apTitle(p.role)} at {p.orgShortName}
      {years}.
    </>
  );
}
