import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { seasonRangeCompact, seasonRangeLabel } from "@/lib/format";
import type { TreeYearsView } from "./model";

type RangeView = Extract<TreeYearsView, { kind: "range" }>;

/** One year with the dotted mark (§6.2); the tooltip gives the reason. Screen readers get it from the label. */
function Dotted({ reason, children }: { reason: string | null; children: ReactNode }) {
  return (
    <span className="inf" title={reason ? `Inferred: ${reason}` : "Inferred from the source, not stated in it"}>
      {children}
    </span>
  );
}

/**
 * The compact range ("2010–19", "2020–", "2003") with the dotted mark on each inferred bound only: an
 * inferred start dots "2010", an inferred end dots "19"; the dash and a known year stay plain.
 */
function CompactParts({ view }: { view: RangeView }) {
  const text = seasonRangeCompact(view.startYear, view.endYear, view.ongoing);
  const dash = text.indexOf("–");
  if (dash < 0) {
    // A single season: either bound being inferred marks it.
    return view.inferred ? <Dotted reason={view.reason}>{text}</Dotted> : <>{text}</>;
  }
  const start = text.slice(0, dash);
  const end = text.slice(dash + 1);
  return (
    <>
      {view.startInferred ? <Dotted reason={view.startReason}>{start}</Dotted> : start}–
      {end && (view.endInferred ? <Dotted reason={view.endReason}>{end}</Dotted> : end)}
    </>
  );
}

/** The spoken form: "2010–2019, 10 seasons (start inferred)". */
function spoken(view: RangeView): string {
  const which = view.startInferred && view.endInferred ? "inferred" : view.startInferred ? "start inferred" : view.endInferred ? "end inferred" : null;
  return seasonRangeLabel(view.startYear, view.endYear, view.ongoing) + (which ? ` (${which})` : "");
}

/**
 * A tree link's years on the right of its row (§8.4): the compact range ("2010–12", "2020–"), with only
 * the inferred year dotted; "Current" when the two are on a staff together now but the source doesn't say
 * since when; nothing when the source doesn't pin the years. Never a filled-in season.
 */
export function TreeRange({ view, className }: { view: TreeYearsView; className?: string }) {
  if (view.kind === "none") return null;
  if (view.kind === "current") {
    return (
      <span className={cn("text-caption font-medium text-fg-2", className)} title="On the same staff now. The start year is not in the source.">
        Current<span className="sr-only"> (start year not in source)</span>
      </span>
    );
  }
  return (
    <span className={cn("num whitespace-nowrap text-caption font-medium", className)}>
      <span aria-hidden="true">
        <CompactParts view={view} />
      </span>
      <span className="sr-only">{spoken(view)}</span>
    </span>
  );
}

/**
 * Every period of a tree link on the right of its row (TreeLink.periods), oldest first: "2010–12, 2020–",
 * each inferred year dotted on its own, "Current" last for a period whose start the source doesn't give.
 * A pair with one period reads exactly as TreeRange. Nothing when the source pins no years.
 */
export function TreeRuns({ runs, className }: { runs: TreeYearsView[]; className?: string }) {
  if (!runs.length) return null;
  if (runs.length === 1) return <TreeRange view={runs[0]} className={className} />;
  const words = runs.map((v) => (v.kind === "range" ? spoken(v) : "current, start year not in source")).join("; ");
  return (
    <span className={cn("num whitespace-nowrap text-caption font-medium", className)}>
      <span aria-hidden="true">
        {runs.map((v, i) => (
          <span key={i}>
            {i > 0 && ", "}
            {v.kind === "range" ? (
              <CompactParts view={v} />
            ) : (
              <span className="text-fg-2" title="On the same staff now. The start year is not in the source.">
                Current
              </span>
            )}
          </span>
        ))}
      </span>
      <span className="sr-only">{words}</span>
    </span>
  );
}

/** The same years inside a sentence ("Played for Ian 2024–25", "both at George Fox · 2015–24"). */
export function InlineYears({ view }: { view: TreeYearsView }) {
  if (view.kind !== "range") return null;
  return (
    <span className="num whitespace-nowrap">
      <span aria-hidden="true">
        <CompactParts view={view} />
      </span>
      <span className="sr-only">{spoken(view)}</span>
    </span>
  );
}
