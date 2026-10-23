/*
 * What a tree edge's years can honestly show in the explorer (DESIGN.md §6.1, §6.2). Pure: no data access.
 *
 * Builds on the profile's linkYears (the same sides and coverage rules, so a link reads the same on the
 * profile card and here) and adds one thing the explorer needs: which bound of a run is inferred, so only
 * that year carries the dotted mark ("2004–05" with only 2004 dotted), and the evidence for each one.
 * An undated current stint pins no start year: such a run reads "Current", never "2026–".
 */
import { CURRENT_SEASON } from "@/lib/brand";
import { coverage, headSide, staffSide, type EdgeRef, type Side, type YearStint } from "@/components/profile/linkYears";

export type InferredFrom = { personId: string; evidence: string | null };

export type EdgeYears = {
  /** The shared seasons run through the current season. */
  ongoing: boolean;
  /** First shared season, only when the source pins it. */
  startYear: number | null;
  /** Last shared season, only when not ongoing and the source pins it. */
  endYear: number | null;
  startInferred: boolean;
  endInferred: boolean;
  /** Whose stint each inferred bound comes from, with its evidence quote (start first). */
  inferredFrom: InferredFrom[];
};

type Bound = { known: boolean; inferred: boolean; from: YearStint | null };

const covers = (t: YearStint, y: number) => {
  const c = coverage(t);
  return !!c && c[0] <= y && y <= c[1];
};

/** One bound of a run, exactly as linkYears decides it (known / inferred), keeping the stint it comes from. */
function bound(sides: Side[], year: number, edge: "start" | "end"): Bound {
  const outside = edge === "start" ? year - 1 : year + 1;
  const bounding = sides.filter((s) => !s.covers(outside));
  if (!bounding.length) {
    const inf = sides.flatMap((s) => s.stints.filter((t) => covers(t, year))).find((t) => !t.yearsExplicit) ?? null;
    return { known: true, inferred: !!inf, from: inf };
  }
  const statuses: Bound[] = bounding.map((s) => {
    const at = s.stints.filter((t) => {
      const c = coverage(t);
      return !!c && (edge === "start" ? c[0] === year : c[1] === year);
    });
    if (!at.length) {
      const inf = s.stints.filter((t) => covers(t, year)).find((t) => !t.yearsExplicit) ?? null;
      return { known: true, inferred: !!inf, from: inf };
    }
    const known = at.filter((t) => (edge === "start" ? t.startYear === year : t.endYear !== null && !t.isCurrent));
    if (!known.length) return { known: false, inferred: false, from: null };
    const explicit = known.find((t) => t.yearsExplicit);
    return explicit ? { known: true, inferred: false, from: explicit } : { known: true, inferred: true, from: known[0] };
  });
  const known = statuses.filter((b) => b.known);
  if (!known.length) return { known: false, inferred: false, from: null };
  return known.find((b) => b.inferred) ?? known[0];
}

const NONE: EdgeYears = { ongoing: false, startYear: null, endYear: null, startInferred: false, endInferred: false, inferredFrom: [] };

/** The years of a stored edge from both people's stints at its organization (linkYears.edgeYears, per bound). */
export function treeEdgeYears(edge: EdgeRef, stints: YearStint[]): EdgeYears {
  const here = stints.filter((t) => t.orgId === edge.orgId);
  const a = edge.kind === "worked_under" ? headSide(edge.mentorId, here) : staffSide(edge.mentorId, here);
  const b = staffSide(edge.menteeId, here);
  const lo = edge.startYear ?? edge.endYear;
  const hi = edge.endYear ?? edge.startYear;
  if (lo === null || hi === null) return NONE;
  const ongoing = hi >= CURRENT_SEASON;
  const start = bound([a, b], lo, "start");
  const end = ongoing ? null : bound([a, b], hi, "end");
  const showStart = start.known && (ongoing || !!end?.known);
  const showEnd = !ongoing && start.known && !!end?.known;
  const startInferred = showStart && start.inferred;
  const endInferred = showEnd && !!end?.inferred;
  const from = (x: Bound | null) => (x?.from ? [{ personId: x.from.personId, evidence: x.from.evidence }] : []);
  return {
    ongoing,
    startYear: showStart ? lo : null,
    endYear: showEnd ? hi : null,
    startInferred,
    endInferred,
    inferredFrom: [...(startInferred ? from(start) : []), ...(endInferred ? from(end) : [])],
  };
}

/** "range": years to show; "current": on a staff together now, start not in the source; "none": nothing pinned. */
export type YearsDisplay = "range" | "current" | "none";

export function yearsDisplay(y: EdgeYears): YearsDisplay {
  if (y.ongoing) return y.startYear ? "range" : "current";
  return y.startYear && y.endYear ? "range" : "none";
}

/** A piece of a compact range; inferred pieces carry the dotted mark. */
export type RangePart = { text: string; inferred: boolean };

/** Compact pieces of one run: "2004" "–" "05", "2020" "–", "2003". Empty unless the display is "range". */
export function compactParts(y: EdgeYears): RangePart[] {
  if (yearsDisplay(y) !== "range" || !y.startYear) return [];
  const s = y.startYear;
  if (y.ongoing) return [{ text: String(s), inferred: y.startInferred }, { text: "–", inferred: false }];
  const e = y.endYear!;
  if (e === s) return [{ text: String(s), inferred: y.startInferred || y.endInferred }];
  const sameCentury = Math.floor(e / 100) === Math.floor(s / 100);
  return [
    { text: String(s), inferred: y.startInferred },
    { text: "–", inferred: false },
    { text: sameCentury ? String(e).slice(2) : String(e), inferred: y.endInferred },
  ];
}

/** The full range in words for labels: "2004–2005, 2 seasons", "2020–Present, 7 seasons", "Current". */
export function yearsInWords(y: EdgeYears): string {
  const d = yearsDisplay(y);
  if (d === "current") return "current (start year not in source)";
  if (d === "none") return "years not in source";
  const s = y.startYear!;
  const e = y.ongoing ? CURRENT_SEASON : y.endYear!;
  const n = e - s + 1;
  const range = y.ongoing ? `${s}–Present` : s === e ? String(s) : `${s}–${e}`;
  const inferred = [y.startInferred && String(s), y.endInferred && !y.ongoing && e !== s && String(e)].filter(Boolean);
  return `${range}, ${n} ${n === 1 ? "season" : "seasons"}${inferred.length ? ` (${inferred.join(" and ")} inferred)` : ""}`;
}
