import type { CSSProperties } from "react";
import { CURRENT_SEASON } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { orgInitials } from "@/lib/format";

export type StripStint = {
  orgId: string;
  shortName: string;
  name?: string | null;
  /** Tile initials; derived from the names when omitted (the same letters as the OrgMark). */
  initials?: string;
  role?: string;
  roleGroup: string;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  asPlayer?: boolean;
};

type Level = "h" | "c" | "p";
type Season = { year: number; level: Level | null; stint: StripStint | null };

const LEVEL_RANK: Record<Level, number> = { h: 3, c: 2, p: 1 };
const LEVEL_FILL: Record<Level, string> = { h: "bg-lvl-head", c: "bg-lvl-coord", p: "bg-lvl-pos" };
const LEVEL_LABEL: Record<Level, string> = { h: "Head coach", c: "Coordinator", p: "Position coach" };

/** Generous width of one 12px/500 Inter character, to tell whether a label fits without measuring. */
const LABEL_CHAR_PX = 6.9;
/** The strip's width at the narrowest phone (390px less two 16px card gutters). */
const PHONE_STRIP_PX = 358;

function levelOf(roleGroup: string): Level {
  if (roleGroup === "head_coach") return "h";
  if (roleGroup === "coordinator") return "c";
  return "p";
}

type SeasonStripProps = {
  stints: StripStint[];
  currentSeason?: number;
  /** Approximate strip width in px, used to decide whether a short name fits its segment. */
  widthHint?: number;
  /** Divider and 16px padding under the figure, as at the top of the Experience card (default true). */
  divider?: boolean;
  className?: string;
};

/**
 * Season strip (§8.3): one cell per season from the first to the current season, filled by the
 * level of that season's main role, an 8px break at every program change, program labels above
 * (one row per program on phone), a year axis and a key. The grid is aria-hidden; the key (with
 * season counts) is its text equivalent. Hidden when fewer than 2 dated seasons.
 */
export function SeasonStrip({ stints, currentSeason = CURRENT_SEASON, widthHint = 712, divider = true, className }: SeasonStripProps) {
  const coaching = stints.filter((s) => !s.asPlayer && s.roleGroup !== "player" && s.startYear);
  if (!coaching.length) return null;
  const endOf = (s: StripStint) => (s.isCurrent ? currentSeason : (s.endYear ?? s.startYear!));
  const first = Math.min(...coaching.map((s) => s.startYear!));
  const last = Math.max(currentSeason, ...coaching.map(endOf));

  const seasons: Season[] = [];
  for (let y = first; y <= last; y++) {
    let best: StripStint | null = null;
    for (const s of coaching) {
      if (s.startYear! > y || endOf(s) < y) continue;
      if (!best) best = s;
      else {
        const a = LEVEL_RANK[levelOf(s.roleGroup)];
        const b = LEVEL_RANK[levelOf(best.roleGroup)];
        if (a > b || (a === b && s.startYear! > best.startYear!)) best = s;
      }
    }
    seasons.push({ year: y, level: best ? levelOf(best.roleGroup) : null, stint: best });
  }
  const dated = seasons.filter((s) => s.level).length;
  if (dated < 2) return null;

  // Segments of consecutive seasons at one program (null = no coaching stint that season).
  type Segment = { orgId: string | null; stint: StripStint | null; from: number; to: number; startCol: number };
  const segments: Segment[] = [];
  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    const orgId = s.stint?.orgId ?? null;
    const prev = segments[segments.length - 1];
    if (prev && prev.orgId === orgId) prev.to = i;
    else segments.push({ orgId, stint: s.stint, from: i, to: i, startCol: 0 });
  }
  const tracks: string[] = [];
  const colOfSeason: number[] = [];
  let col = 1;
  segments.forEach((seg, i) => {
    if (i > 0) {
      tracks.push("4px");
      col++;
    }
    seg.startCol = col;
    const n = seg.to - seg.from + 1;
    tracks.push(n > 1 ? `repeat(${n}, minmax(0, 1fr))` : "minmax(0, 1fr)");
    for (let k = 0; k < n; k++) colOfSeason[seg.from + k] = col + k;
    col += n;
  });
  const lastCol = col - 1;

  // Programs in order of first season: each gets its own row on phone.
  const programs: string[] = [];
  for (const seg of segments) if (seg.orgId && !programs.includes(seg.orgId)) programs.push(seg.orgId);
  const rowOf = (orgId: string | null, fallback: number) => (orgId ? programs.indexOf(orgId) : fallback);

  const textW = (t: string) => t.length * LABEL_CHAR_PX + 2;
  const initialsOf = (st: StripStint) => st.initials ?? orgInitials(st.shortName, st.name);

  // Desktop: one label per program above its segments: its short name if it fits every one of them, else
  // its initials.
  const unit = (widthHint - (segments.length - 1) * 8) / seasons.length;
  const labelOf = new Map<string, string>();
  for (const orgId of programs) {
    const segs = segments.filter((s) => s.orgId === orgId);
    const st = segs[0].stint!;
    const short = st.shortName;
    const fits = segs.every((s) => textW(short) <= (s.to - s.from + 1) * unit);
    labelOf.set(orgId, fits ? short : initialsOf(st));
  }

  // Phone (audit m1): each program has its own row, so its label may run from its first cell to the end of
  // the strip, measured at the narrowest phone width. The short name when it fits there; else the short
  // name end-aligned (it runs left over the row's empty columns, ending at the last season); else the
  // initials the same way; a label that can't fit even as initials is left out.
  const unitPhone = (PHONE_STRIP_PX - (segments.length - 1) * 8) / seasons.length;
  const fromCol = (seasonIndex: number) => (seasons.length - seasonIndex) * unitPhone + segments.filter((sg) => sg.from > seasonIndex).length * 8;
  const phoneLabelOf = new Map<string, { text: string; end: boolean } | null>();
  for (const orgId of programs) {
    const seg = segments.find((s) => s.orgId === orgId)!;
    const st = seg.stint!;
    const room = fromCol(seg.from);
    const pick = [st.shortName, initialsOf(st)]
      .flatMap((text) => [
        { text, end: false, fits: textW(text) <= room },
        { text, end: true, fits: textW(text) <= PHONE_STRIP_PX },
      ])
      .find((o) => o.fits);
    phoneLabelOf.set(orgId, pick ? { text: pick.text, end: pick.end } : null);
  }

  // Axis: first season, each decade start and the current season, without collisions: a decade label is
  // skipped within 3 columns of either end, and on phone also when its text would touch the end labels.
  const yearW = textW("2000") + 6;
  const axisYears: { year: number; phone: boolean }[] = [{ year: first, phone: true }];
  for (let y = first + 1; y < last; y++) {
    if (y % 10 !== 0 || y - first <= 3 || last - y <= 3) continue;
    const phone = (y - first) * unitPhone >= yearW && (last - y + 1) * unitPhone >= 2 * yearW;
    axisYears.push({ year: y, phone });
  }
  if (last > first) axisYears.push({ year: last, phone: true });

  const counts: Record<Level, number> = { h: 0, c: 0, p: 0 };
  for (const s of seasons) if (s.level) counts[s.level]++;
  const axisRow = programs.length * 2 + 1;

  let lastProgramRow = 0;
  return (
    <figure className={cn("my-1", divider && "border-b border-divider pb-4", className)}>
      <div aria-hidden="true" className="grid items-end gap-x-0.5" style={{ gridTemplateColumns: tracks.join(" ") }}>
        {segments.map((seg, i) => {
          if (!seg.orgId) return null;
          const style = { "--s": seg.startCol, "--e": seg.startCol + (seg.to - seg.from) + 1 } as CSSProperties;
          return (
            <span
              key={`l${i}`}
              style={style}
              className="col-start-(--s) col-end-(--e) row-start-1 mb-1.5 min-w-0 overflow-hidden whitespace-nowrap border-b border-border-strong pb-1 text-caption font-medium text-fg-2 max-md:hidden"
            >
              {labelOf.get(seg.orgId)}
            </span>
          );
        })}
        {programs.map((orgId) => {
          const label = phoneLabelOf.get(orgId);
          if (!label) return null;
          const seg = segments.find((s) => s.orgId === orgId)!;
          const style = { "--s": label.end ? 1 : seg.startCol, "--lr": rowOf(orgId, 0) * 2 + 1 } as CSSProperties;
          return (
            <span
              key={`p${orgId}`}
              style={style}
              className={cn(
                "col-start-(--s) col-end-[-1] row-start-(--lr) min-w-0 whitespace-nowrap pb-0.5 pt-1.5 text-caption font-medium text-fg-2 md:hidden",
                label.end && "text-right",
              )}
            >
              {label.text}
            </span>
          );
        })}
        {seasons.map((s, i) => {
          const r = s.stint ? rowOf(s.stint.orgId, 0) : lastProgramRow;
          lastProgramRow = r;
          const style = { "--c": colOfSeason[i], "--cr": r * 2 + 2 } as CSSProperties;
          return (
            <i
              key={s.year}
              style={style}
              title={s.stint ? `${s.year} · ${[s.stint.role, s.stint.shortName].filter(Boolean).join(", ")}` : `${s.year} · No coaching stint in the source`}
              className={cn(
                "col-start-(--c) row-start-2 block h-4 rounded-[3px] max-md:row-start-(--cr) max-md:h-2.5 max-md:rounded-[2px]",
                s.level ? LEVEL_FILL[s.level] : "border border-dashed border-border-strong",
              )}
            />
          );
        })}
        {axisYears.map(({ year: y, phone }, k) => {
          const isLast = k === axisYears.length - 1 && y === last && last > first;
          const c = colOfSeason[y - first];
          const style = (
            isLast ? { "--a": Math.max(1, colOfSeason[Math.max(0, y - first - 2)]), "--b": lastCol + 1 } : { "--a": c, "--b": Math.min(lastCol + 1, c + 3) }
          ) as CSSProperties;
          return (
            <span
              key={y}
              style={{ ...style, "--xr": axisRow } as CSSProperties}
              className={cn(
                "num col-start-(--a) col-end-(--b) row-start-3 mt-1.5 whitespace-nowrap text-caption text-fg-3 max-md:row-start-(--xr)",
                isLast && "justify-self-end",
                !phone && "max-md:hidden",
              )}
            >
              {y}
            </span>
          );
        })}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-small text-fg-2">
        {(Object.keys(counts) as Level[])
          .filter((l) => counts[l] > 0)
          .map((l) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className={cn("size-3 shrink-0 rounded-[3px]", LEVEL_FILL[l])} />
              <span>
                {LEVEL_LABEL[l]} · <b className="num font-semibold text-fg-1">{counts[l]}</b> {counts[l] === 1 ? "season" : "seasons"}
              </span>
            </span>
          ))}
      </figcaption>
    </figure>
  );
}
