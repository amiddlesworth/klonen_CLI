import type { ReactNode } from "react";
import { Network } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredYear } from "@/components/data/InferredYear";
import { seasonRangeCompact, seasonRangeLabel, titleShort } from "@/lib/format";
import type { Span, TreeContext } from "@/lib/queries/searchx";

const INFERRED_REASON = "Estimated from the wording of a staff bio, not stated in it";

/** Compact years ("2010–19", "2023–") with the full range for screen readers; dotted when inferred. */
function Years({ span }: { span: Span }) {
  if (span.start == null) return null;
  const compact = seasonRangeCompact(span.start, span.end, span.current);
  const label = seasonRangeLabel(span.start, span.end, span.current);
  const visible = <span aria-hidden="true">{compact}</span>;
  return (
    <span className="num">
      {span.inferred ? <InferredYear reason={INFERRED_REASON}>{visible}</InferredYear> : visible}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A start year alone ("since 2020"), dotted when inferred. */
function StartYear({ span }: { span: Span }) {
  if (span.start == null) return null;
  return <span className="num">{span.inferred ? <InferredYear reason={INFERRED_REASON}>{span.start}</InferredYear> : span.start}</span>;
}

/**
 * One line of tree context on a person result (§8.7): "Worked under Ian Falconer at Pacific (OR),
 * 2023–", "Offensive Line Coach at Pacific (OR), 2010–19", "6 coached under Ian",
 * "Worked alongside you at Pacific (OR), 2023–24".
 */
export function TreeContextLine({
  ctx,
  firstName,
  mentorNamed,
  orgNamed,
}: {
  ctx: TreeContext | undefined;
  firstName: string;
  /** The heading names the "Worked under" coach: use the first name. */
  mentorNamed?: boolean;
  /** The heading names the "Worked at" program: leave it out of the line. */
  orgNamed?: boolean;
}) {
  if (!ctx) return null;
  let body: ReactNode;
  switch (ctx.kind) {
    case "workedUnder":
      body = (
        <>
          {/* The heading already names the coach under a "Worked under" filter: first name only. */}
          Worked under {mentorNamed ? ctx.mentorFirst : ctx.mentorName} at {ctx.org}
          {ctx.start != null && (
            <>
              , <Years span={ctx} />
            </>
          )}
        </>
      );
      break;
    case "workedAt": {
      const at = orgNamed ? "" : ` at ${ctx.org}`;
      body = ctx.current ? (
        ctx.start != null ? (
          <>
            {orgNamed ? "On staff" : `On the ${ctx.org} staff`} since <StartYear span={ctx} />
          </>
        ) : (
          <>{orgNamed ? "On the current staff" : `On the current ${ctx.org} staff`}</>
        )
      ) : (
        <>
          {ctx.role ? `${titleShort(ctx.role)}${at}` : `Coached${at || " there"}`}
          {ctx.start != null ? (
            <>
              , <Years span={ctx} />
            </>
          ) : (
            " · years not in source"
          )}
        </>
      );
      break;
    }
    case "viewer": {
      const lead = ctx.relation === "mentor" ? `You worked under ${firstName} at ${ctx.org}` : ctx.relation === "mentee" ? `Coached under you at ${ctx.org}` : `Worked alongside you at ${ctx.org}`;
      body = (
        <>
          {lead}
          {ctx.start != null && (
            <>
              , <Years span={ctx} />
            </>
          )}
        </>
      );
      break;
    }
    case "mentees":
      body = (
        <>
          <span className="num">{ctx.count}</span> coached under {firstName}
        </>
      );
      break;
  }
  return <ContextLine icon={Network}>{body}</ContextLine>;
}

export function contextInferred(ctx: TreeContext | undefined): boolean {
  return !!ctx && ctx.kind !== "mentees" && ctx.start != null && ctx.inferred;
}
