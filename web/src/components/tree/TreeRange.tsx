import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { CURRENT_TITLE, type ContextView, type RangeView } from "./copy";

const inferredTitle = (reasons: string[]) => (reasons.length ? `Inferred: ${reasons.join(" · ")}` : "Inferred from the source, not stated in it");

type RangeTextView = Pick<RangeView, "kind" | "parts" | "label" | "reasons">;

/**
 * A member's years at the right of a tree row (DESIGN.md §6.1, §6.2): compact runs ("2004–05", "2022, 2024"),
 * with the dotted mark only on the year that is inferred and its reason in the tooltip; "Current" when the
 * two are on a staff together now but the source doesn't say since when (the profile card's words);
 * nothing when the source pins no years. Screen readers get the runs in words.
 */
export function RangeText({ view, className }: { view: RangeTextView; className?: string }) {
  if (view.kind === "none") return null;
  if (view.kind === "current") {
    return (
      <span className={cn("text-caption font-medium whitespace-nowrap text-fg-1", className)} title={CURRENT_TITLE}>
        Current<span className="sr-only"> (start year not in source)</span>
      </span>
    );
  }
  return (
    <span className={cn("num whitespace-nowrap text-caption font-medium", className)}>
      <span className="sr-only">{view.label}</span>
      <span aria-hidden="true">
        {view.parts.map((p, i) =>
          p.inferred ? (
            <span key={i} className="inf" title={inferredTitle(view.reasons)}>
              {p.text}
            </span>
          ) : p.text === "Current" ? (
            <span key={i} title={CURRENT_TITLE}>
              {p.text}
            </span>
          ) : (
            <Fragment key={i}>{p.text}</Fragment>
          ),
        )}
      </span>
    </span>
  );
}

/** A context line's text with its year or range, dotted when inferred ("Joined Ian's staff in 2020", "Played for Ian 2024–25"). */
export function ContextText({ view }: { view: ContextView }) {
  if (view.range) {
    return (
      <>
        {view.text} <RangeText view={view.range} className="font-normal" />
      </>
    );
  }
  if (!view.year) return <>{view.text}</>;
  const { value, inferred, reason } = view.year;
  return (
    <>
      {view.text}{" "}
      {inferred ? (
        <>
          <span className="num inf" title={inferredTitle(reason ? [reason] : [])}>
            {value}
          </span>
          <span className="sr-only"> (inferred)</span>
        </>
      ) : (
        <span className="num">{value}</span>
      )}
    </>
  );
}
