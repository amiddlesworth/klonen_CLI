import { initials, tintFor, type Tint } from "@/lib/format";
import type { RangePart } from "./years";

/*
 * Layered layout for the coaching tree diagram (DESIGN.md §8.8). Pure geometry, no physics:
 *
 *   two steps up            (depth 2, small nodes, one block of rows per first-level coach)
 *   worked under            (rows of 6; 4 in the narrow layout)
 *   alongside · FOCAL · alongside
 *   coached under {first}   (rows of 6; 4 in the narrow layout)
 *   two steps down          (depth 2)
 *
 * Two variants share the code: "wide" (lg, rows of 6) and "narrow" (md, rows of 4, narrower peer
 * columns with their label above the left column), so the default tablet view fits the card without
 * scrolling or shrinking text below 12px.
 *
 * Edges are org-chart connectors with rounded corners: a trunk from the focal coach to a bus line in
 * the gap above (or below) each row, then a short drop to the node. Rows that a trunk or a second-level
 * connector passes through keep their nodes on half-pitch offsets, so the vertical lanes at whole-pitch
 * offsets always run through gaps between labels, never through a node. Edges share trunks, so the
 * renderer draws them as one path (a shared segment is painted once, at 1.5px) and keeps a merged
 * highlight path per node.
 */

export type DiagramRange = {
  /** Compact range pieces ("2004" "–" "05", or "2022" ", " "2024"); inferred pieces get the dotted mark. */
  parts: RangePart[];
  /** Shorter pieces when `parts` doesn't fit ("2024 · 2 stints"). */
  short: RangePart[] | null;
  /** Tooltip on the range: why a year is dotted, or what "Current" means. */
  title: string | null;
};

export type DiagramMemberInput = {
  /** Unique node key ("mentees:p-jim-craft"); a person can sit in two groups. */
  key: string;
  slug: string;
  name: string;
  /** Program to show before the range, only where it adds something; dropped when it doesn't fit. */
  program: string | null;
  range: DiagramRange;
  /** Accessible name of the profile link (name, title and the relationship in words). */
  label: string;
  /** The signed-in viewer: an Iris ring around the avatar (the viewer's own row in a chart), named in the legend. */
  you?: boolean;
};

export type DiagramSecondInput = DiagramMemberInput & {
  /** First-level coaches this person connects through, each with the program where they overlapped. */
  parents: { key: string; program: string }[];
};

export type DiagramPill = { text: string; count: number; extra?: string | null };

export type DiagramInput = {
  focal: { key: string; slug: string; name: string; title: string | null; label: string; you?: boolean };
  mentors: DiagramMemberInput[];
  peers: DiagramMemberInput[];
  mentees: DiagramMemberInput[];
  up: DiagramSecondInput[];
  down: DiagramSecondInput[];
  pills: { mentors: DiagramPill | null; peers: DiagramPill | null; mentees: DiagramPill | null; up: DiagramPill | null; down: DiagramPill | null };
};

export type LayoutVariant = "wide" | "narrow";

export type NodeKind = "focal" | "member" | "second" | "peer-left" | "peer-right";

export type PlacedSub = {
  program: string | null;
  parts: RangePart[];
  /** Dotted marks under inferred pieces (approximate; the client re-measures them). */
  marks: { part: number; x: number; w: number }[];
  /** Hover area for the range tooltip. */
  hit: { x: number; y: number; w: number; h: number } | null;
  title: string | null;
};

export type PlacedNode = {
  key: string;
  slug: string;
  kind: NodeKind;
  cx: number;
  cy: number;
  r: number;
  initials: string;
  tint: Tint;
  /** Display name, truncated with an ellipsis to fit; the full name is in `fullName`. */
  name: string;
  fullName: string;
  /** Second line: optional program · compact range (the range is never truncated). */
  sub: PlacedSub | null;
  /** A peer's program on its own line, when it doesn't fit beside the range. */
  programLine: { text: string; y: number } | null;
  /** The focal coach's current title (truncated). */
  titleLine: string | null;
  label: string;
  you: boolean;
  textAnchor: "middle" | "start" | "end";
  textX: number;
  nameY: number;
  subY: number;
  nameSize: number;
  /** Focus ring and hover area. */
  ring: { x: number; y: number; w: number; h: number };
};

/** One connector; `ends` are the node keys whose hover or focus highlights it. */
export type PlacedEdge = { key: string; ends: string[]; d: string };

/** A label sitting on the connectors: group pills (with their count) and "Via …" captions. */
export type PlacedLabel = {
  key: string;
  x: number;
  y: number;
  anchor: "middle" | "start" | "end";
  parts: { text: string; tone: "strong" | "count" | "muted" }[];
  box: { x: number; y: number; w: number; h: number };
};

export type DiagramLayout = {
  width: number;
  height: number;
  /** Translate raw coordinates (focal avatar centre at 0,0) into the SVG viewport. */
  tx: number;
  ty: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  labels: PlacedLabel[];
};

/* ---------- Geometry ---------- */

const PITCH = 148; // slot width of a node in a row
const LABEL_W = 132; // max text width under a node (PITCH − 16: 8px clearance each side of a lane)
const R1 = 20; // first level: avatar 40
const R2 = 16; // second level: avatar 32
const RF = 32; // focal: avatar 64
const NODE_BELOW = 40; // avatar bottom → node bottom (6px gap + two 16px lines + 2)
const FOCAL_BOTTOM = RF + 48; // focal avatar centre → bottom of its title line
const ROW_GAP = 44;
const BAND_GAP = 84; // last first-level row → first band row: room for the band pill and a caption
const BLOCK_GAP = 56; // a new block of the band: room for its "Via …" caption
const BUS_INSET = 22; // bus line distance from the row it feeds
const PEER_PITCH = 52;
const STUB = 16; // spine → peer avatar
const PILL_PAD = 14;
const PILL_H = 20;
const CAPTION_W = 232; // longest caption; it also stops short of the nearest connector
const MARGIN = 8;

type Geo = { perRow: number; focalTextW: number; peerTextW: number; peerPillAbove: boolean };
const GEO: Record<LayoutVariant, Geo> = {
  wide: { perRow: 6, focalTextW: 240, peerTextW: 148, peerPillAbove: false },
  narrow: { perRow: 4, focalTextW: 184, peerTextW: 100, peerPillAbove: true },
};

/* ---------- Text measurement (Inter, advance widths in em, calibrated against Chromium) ---------- */

const NARROW = new Set("iljI.,:;'’|!·");
const SEMI_NARROW = new Set("ftr()[]-/ ");
const WIDE = new Set("mwMW");
const UPPER = /[A-Z]/;
const DIGIT = /[0-9]/;

function charEm(ch: string): number {
  if (NARROW.has(ch)) return 0.27;
  if (SEMI_NARROW.has(ch)) return ch === " " ? 0.28 : 0.36;
  if (WIDE.has(ch)) return ch === ch.toUpperCase() ? 0.92 : 0.84;
  if (ch === "…") return 0.8;
  if (ch === "&") return 0.66;
  if (UPPER.test(ch)) return 0.68;
  return 0.56;
}

/** Tabular digits and the en dash keep their width at every weight. */
function fixedEm(ch: string): number | null {
  if (DIGIT.test(ch)) return 0.65;
  if (ch === "–") return 0.5;
  return null;
}

export function textWidth(text: string, size: number, weight: 400 | 500 | 600 = 400): number {
  const k = weight === 600 ? 1.05 : weight === 500 ? 1.025 : 1;
  let px = 0;
  for (const ch of text) {
    const f = fixedEm(ch);
    px += f !== null ? f * size : charEm(ch) * size * k;
  }
  return px;
}

export function truncate(text: string, maxW: number, size: number, weight: 400 | 500 | 600 = 400): string {
  if (textWidth(text, size, weight) <= maxW) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t.trimEnd()}…`, size, weight) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

const partsWidth = (parts: RangePart[]) => parts.reduce((w, p) => w + textWidth(p.text, 12, 500), 0);
const SEP = " · ";

/* ---------- Paths ---------- */

type Pt = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** An axis-aligned polyline with rounded corners (radius clamped to half of each segment). */
export function roundedPath(points: Pt[], radius = 10): string {
  const dedup: Pt[] = [];
  for (const q of points) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.abs(last[0] - q[0]) > 0.01 || Math.abs(last[1] - q[1]) > 0.01) dedup.push(q);
  }
  const pts: Pt[] = [];
  for (let i = 0; i < dedup.length; i++) {
    if (pts.length >= 1 && i < dedup.length - 1) {
      const [ax, ay] = pts[pts.length - 1];
      const [bx, by] = dedup[i];
      const [cx, cy] = dedup[i + 1];
      if (Math.abs((bx - ax) * (cy - by) - (by - ay) * (cx - bx)) < 0.01) continue;
    }
    pts.push(dedup[i]);
  }
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === pts.length - 1) {
      d += ` L${r1(x)} ${r1(y)}`;
      break;
    }
    const [px, py] = pts[i - 1];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const ax = x - ((x - px) / l1) * r;
    const ay = y - ((y - py) / l1) * r;
    const bx = x + ((nx - x) / l2) * r;
    const by = y + ((ny - y) / l2) * r;
    d += ` L${r1(ax)} ${r1(ay)} Q${r1(x)} ${r1(y)} ${r1(bx)} ${r1(by)}`;
  }
  return d;
}

/** Vertical segments of a polyline, for keeping labels off the connectors. */
type VSeg = { x: number; y0: number; y1: number };
function verticals(points: Pt[]): VSeg[] {
  const out: VSeg[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    if (Math.abs(ax - bx) < 0.01 && Math.abs(ay - by) > 0.01) out.push({ x: ax, y0: Math.min(ay, by), y1: Math.max(ay, by) });
  }
  return out;
}
const crosses = (v: VSeg, top: number, bottom: number, left: number, right: number) => v.y0 < bottom && v.y1 > top && v.x > left && v.x < right;

/* ---------- Rows ---------- */

type Row = { cy: number; top: number; bottom: number; bus: number; near: number; far: number; xs: number[] };

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** The whole-pitch lane nearest to x, toward the target when x sits on a half pitch. */
function laneFor(x: number, toward: number): number {
  const k = x / PITCH;
  if (Math.abs(k - Math.round(k)) < 0.01) return Math.round(k) * PITCH;
  return (toward > x ? Math.ceil(k) : Math.floor(k)) * PITCH;
}

/* ---------- Nodes ---------- */

/** The second line: the range always, the program before it only when both fit; inferred pieces get marks. */
function subLine(m: DiagramMemberInput, maxW: number, anchor: "middle" | "start" | "end", textX: number, subY: number): { sub: PlacedSub; width: number } {
  let parts = m.range.parts;
  if (m.range.short && partsWidth(parts) > maxW) parts = m.range.short;
  const rw = partsWidth(parts);
  const programW = m.program ? textWidth(m.program + SEP, 12) : 0;
  const program = m.program && programW + rw <= maxW ? m.program : null;
  const lead = program ? programW : 0;
  const width = lead + rw;
  const x0 = anchor === "middle" ? textX - width / 2 : anchor === "start" ? textX : textX - width;
  const marks: PlacedSub["marks"] = [];
  let at = x0 + lead;
  parts.forEach((p, i) => {
    const w = textWidth(p.text, 12, 500);
    if (p.inferred) marks.push({ part: i, x: at, w });
    at += w;
  });
  const hit = m.range.title && rw > 0 ? { x: x0 + lead - 2, y: subY - 12, w: rw + 4, h: 18 } : null;
  return { sub: { program, parts, marks, hit, title: m.range.title }, width };
}

/** The program doesn't fit beside the range but fits on a line of its own. */
function needsProgramLine(m: DiagramMemberInput, maxW: number): boolean {
  if (!m.program || textWidth(m.program, 12) > maxW) return false;
  const parts = m.range.short && partsWidth(m.range.parts) > maxW ? m.range.short : m.range.parts;
  return textWidth(m.program + SEP, 12) + partsWidth(parts) > maxW;
}

/**
 * A node in a row: avatar, name, then "program · range" (or the range alone). With `programLine`, a
 * program that doesn't fit beside the range gets its own line, so a coach from another staff never
 * reads as one from the coach's current program; the row grows 16px to hold it.
 */
function verticalNode(m: DiagramMemberInput, cx: number, cy: number, r: number, kind: "member" | "second", programLine = false): PlacedNode {
  const name = truncate(m.name, LABEL_W, 12, 600);
  const third = programLine && needsProgramLine(m, LABEL_W);
  const subY = cy + r + (third ? 50 : 34);
  const { sub, width } = subLine(third ? { ...m, program: null } : m, LABEL_W, "middle", cx, subY);
  const textW = Math.max(textWidth(name, 12, 600), width, third ? textWidth(m.program!, 12) : 0, 2 * r);
  return {
    key: m.key,
    slug: m.slug,
    kind,
    cx,
    cy,
    r,
    initials: initials(m.name),
    tint: tintFor(m.slug),
    name,
    fullName: m.name,
    sub,
    programLine: third ? { text: m.program!, y: cy + r + 34 } : null,
    titleLine: null,
    label: m.label,
    you: !!m.you,
    textAnchor: "middle",
    textX: cx,
    nameY: cy + r + 18,
    subY,
    nameSize: 12,
    ring: { x: cx - textW / 2 - 6, y: cy - r - 6, w: textW + 12, h: 2 * r + NODE_BELOW + (third ? 16 : 0) + 8 },
  };
}

function peerNode(m: DiagramMemberInput, cx: number, cy: number, side: "left" | "right", maxW: number): PlacedNode {
  const name = truncate(m.name, maxW, 12, 600);
  const left = side === "left";
  const anchor = left ? "end" : "start";
  const textX = left ? cx - R1 - 8 : cx + R1 + 8;
  let subY = cy + 13;
  let { sub, width } = subLine(m, maxW, anchor, textX, subY);
  // A program that doesn't fit beside the range gets its own line (name · program · range, 16px apart),
  // so a peer from another staff never reads as one from the coach's current program.
  let programLine: PlacedNode["programLine"] = null;
  let nameY = cy - 3;
  if (m.program && needsProgramLine(m, maxW)) {
    nameY = cy - 11;
    subY = cy + 21;
    ({ sub, width } = subLine({ ...m, program: null }, maxW, anchor, textX, subY));
    programLine = { text: m.program, y: cy + 5 };
    width = Math.max(width, textWidth(m.program, 12));
  }
  const textW = Math.max(textWidth(name, 12, 600), width);
  return {
    key: m.key,
    slug: m.slug,
    kind: left ? "peer-left" : "peer-right",
    cx,
    cy,
    r: R1,
    initials: initials(m.name),
    tint: tintFor(m.slug),
    name,
    fullName: m.name,
    sub,
    programLine,
    titleLine: null,
    label: m.label,
    you: !!m.you,
    textAnchor: anchor,
    textX,
    nameY,
    subY,
    nameSize: 12,
    ring: left
      ? { x: textX - textW - 6, y: cy - R1 - 6, w: textW + 8 + 2 * R1 + 12, h: 2 * R1 + 12 }
      : { x: cx - R1 - 6, y: cy - R1 - 6, w: 2 * R1 + 8 + textW + 12, h: 2 * R1 + 12 },
  };
}

/** A group pill: "Coached under Ian · 14", optionally " · Oberlin". */
function pillLabel(key: string, p: DiagramPill, x: number, y: number, anchor: PlacedLabel["anchor"] = "middle"): PlacedLabel {
  const parts: PlacedLabel["parts"] = [
    { text: p.text, tone: "strong" },
    { text: `${SEP}${p.count}`, tone: "count" },
  ];
  if (p.extra) parts.push({ text: `${SEP}${p.extra}`, tone: "muted" });
  return placeLabel(key, parts, x, y, anchor, 8);
}

function placeLabel(key: string, parts: PlacedLabel["parts"], x: number, y: number, anchor: PlacedLabel["anchor"], pad: number, h = PILL_H): PlacedLabel {
  const w = parts.reduce((s, p) => s + textWidth(p.text, 12, p.tone === "muted" ? 400 : 500), 0);
  const left = anchor === "middle" ? x - w / 2 : anchor === "start" ? x : x - w;
  return { key, x, y, anchor, parts, box: { x: left - pad, y: y - h / 2, w: w + 2 * pad, h } };
}

/* ---------- Layout ---------- */

type Side = { rows: Row[]; nodes: PlacedNode[]; edges: PlacedEdge[]; labels: PlacedLabel[]; bus0: number | null };

/**
 * One side of the focal coach (dir 1 = below, −1 = above): the first-level rows, then the
 * second-level band, with their connectors and labels.
 */
function placeSide(
  dir: 1 | -1,
  level1: DiagramMemberInput[],
  band: DiagramSecondInput[],
  bandPill: DiagramPill | null,
  focalKey: string,
  clear: number,
  geo: Geo,
  names: Map<string, string>,
  minHalf: number,
): Side {
  const out: Side = { rows: [], nodes: [], edges: [], labels: [], bus0: null };
  if (!level1.length) return out;
  const perRow = geo.perRow;

  /** Horizontal offsets (in pitches) for n nodes; lane-safe rows keep whole-pitch offsets free. */
  const rowOffsets = (n: number, laneSafe: boolean): number[] => {
    if (laneSafe && n % 2 === 1) {
      const start = Math.floor((perRow - n) / 2);
      return Array.from({ length: n }, (_, i) => start + i - (perRow - 1) / 2);
    }
    return Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
  };

  // Parents of second-level people go last, so they sit in the outermost row next to the band.
  const parentKeys = new Set(band.flatMap((b) => b.parents.map((p) => p.key)));
  const ordered = band.length ? [...level1.filter((m) => !parentKeys.has(m.key)), ...level1.filter((m) => parentKeys.has(m.key))] : level1;
  const chunks = chunk(ordered, perRow);
  const parentNotOutermost = chunks.slice(0, -1).some((c) => c.some((m) => parentKeys.has(m.key)));

  const focalEdge = dir > 0 ? FOCAL_BOTTOM : -RF;
  const rows: Row[] = [];
  let cursor = 0;
  chunks.forEach((c, i) => {
    const laneSafe = i < chunks.length - 1 || parentNotOutermost;
    const xs = rowOffsets(c.length, laneSafe).map((o) => o * PITCH);
    const below = NODE_BELOW + (c.some((m) => needsProgramLine(m, LABEL_W)) ? 16 : 0);
    let row: Row;
    if (dir > 0) {
      const bus = i === 0 ? Math.max(FOCAL_BOTTOM + 42, clear + 28) : cursor + ROW_GAP - BUS_INSET;
      const top = bus + BUS_INSET;
      const cy = top + R1;
      const bottom = cy + R1 + below;
      row = { cy, top, bottom, bus, near: top, far: bottom, xs };
      cursor = bottom;
    } else {
      const bus = i === 0 ? Math.min(-RF - 42, -(clear + 28)) : cursor - ROW_GAP + BUS_INSET;
      const bottom = bus - BUS_INSET;
      const cy = bottom - below - R1;
      const top = cy - R1;
      row = { cy, top, bottom, bus, near: bottom, far: top, xs };
      cursor = top;
    }
    rows.push(row);
  });
  out.bus0 = rows[0].bus;

  const where = new Map<string, { row: number; x: number }>();
  chunks.forEach((c, i) =>
    c.forEach((m, j) => {
      const x = rows[i].xs[j];
      where.set(m.key, { row: i, x });
      out.nodes.push(verticalNode(m, x, rows[i].cy, R1, "member", true));
      out.edges.push({
        key: `${focalKey}>${m.key}`,
        ends: [focalKey, m.key],
        d: roundedPath([
          [0, focalEdge],
          [0, rows[i].bus],
          [x, rows[i].bus],
          [x, rows[i].near],
        ]),
      });
    }),
  );

  if (!band.length) {
    out.rows = rows;
    for (const n of out.nodes) names.set(n.key, n.fullName);
    return out;
  }

  // Second level: one block of rows per first-level person (their first parent, left to right), so
  // each row's bus line belongs to one parent. Every row but the outermost stays lane-safe, because
  // later blocks' connectors run down the lanes through it.
  const xOf = (key: string) => where.get(key)?.x ?? 0;
  const primary = (b: DiagramSecondInput) => [...b.parents].sort((p, q) => xOf(p.key) - xOf(q.key))[0]?.key ?? "";
  const groups = new Map<string, DiagramSecondInput[]>();
  for (const b of band) groups.set(primary(b), [...(groups.get(primary(b)) ?? []), b]);
  const blocks = [...groups.entries()].sort(([a], [b]) => xOf(a) - xOf(b));
  // A program every member of a block shares with its coach is named once, in the block's caption.
  const blockProgram = new Map(
    blocks.map(([parent, list]) => {
      const programs = list.map((b) => b.parents.find((p) => p.key === parent)?.program ?? "");
      return [parent, programs.every((x) => x && x === programs[0]) ? programs[0] : null] as const;
    }),
  );
  const bandChunks = blocks.flatMap(([parent, list]) => chunk(list, perRow).map((c, i) => ({ parent, c, first: i === 0 })));
  const bandRows: Row[] = [];
  const zoneStart = cursor; // the last first-level row's far edge: the band pill sits just past it
  bandChunks.forEach(({ c, first }, i) => {
    const xs = rowOffsets(c.length, i < bandChunks.length - 1).map((o) => o * PITCH);
    const gap = i === 0 ? BAND_GAP : first ? BLOCK_GAP : ROW_GAP;
    let row: Row;
    if (dir > 0) {
      const top = cursor + gap;
      const cy = top + R2;
      const bottom = cy + R2 + NODE_BELOW;
      row = { cy, top, bottom, bus: top - BUS_INSET, near: top, far: bottom, xs };
      cursor = bottom;
    } else {
      const bottom = cursor - gap;
      const cy = bottom - NODE_BELOW - R2;
      const top = cy - R2;
      row = { cy, top, bottom, bus: bottom + BUS_INSET, near: bottom, far: top, xs };
      cursor = top;
    }
    bandRows.push(row);
  });

  const lastL = rows.length - 1;
  const segs: VSeg[] = [];
  /** Where each block's connector meets its first row's bus (the caption sits next to it). */
  const junction = new Map<number, number>();
  bandChunks.forEach(({ parent, c, first }, k) =>
    c.forEach((b, j) => {
      const xc = bandRows[k].xs[j];
      for (const { key: p } of b.parents) {
        const at = where.get(p);
        if (!at) continue;
        const farP = rows[at.row].far;
        let pts: Pt[];
        let inX: number;
        if (at.row === lastL && k === 0) {
          inX = at.x;
          pts = [
            [at.x, farP],
            [at.x, bandRows[0].bus],
            [xc, bandRows[0].bus],
            [xc, bandRows[0].near],
          ];
        } else {
          // Jog over to the lane in the clear gap just past the parent's row, never along another row's
          // bus, so the connector can't read as a drop to a node that sits under the parent.
          const jog = at.row < lastL ? farP + dir * 11 : zoneStart + dir * 37;
          const lane = laneFor(at.x, xc);
          inX = lane;
          pts = [
            [at.x, farP],
            [at.x, jog],
            [lane, jog],
            [lane, bandRows[k].bus],
            [xc, bandRows[k].bus],
            [xc, bandRows[k].near],
          ];
        }
        if (first && p === parent && !junction.has(k)) junction.set(k, inX);
        segs.push(...verticals(pts));
        out.edges.push({ key: `${p}>${b.key}`, ends: [p, b.key], d: roundedPath(pts) });
      }
    }),
  );
  out.rows = [...rows, ...bandRows];
  // Labels stay inside the canvas the nodes already need (at least 280px each side), so they never widen it.
  const rowHalf = Math.max(minHalf, ...out.rows.flatMap((r) => r.xs.map((x) => Math.abs(x) + LABEL_W / 2)));

  // The band pill ("Two steps down · 17"), on the connectors between the first-level rows and the band:
  // at the centre when no connector runs through there, else at the nearest clear half pitch.
  if (bandPill) {
    const y = zoneStart + dir * 20;
    const probe = pillLabel("band", bandPill, 0, y);
    const w = probe.box.w;
    const candidates = [0, ...Array.from({ length: 8 }, (_, i) => (i % 2 ? -1 : 1) * Math.ceil((i + 1) / 2) * (PITCH / 2))];
    const clearAt =
      candidates.filter((x) => Math.abs(x) + w / 2 <= rowHalf).find((x) => !segs.some((v) => crosses(v, y - PILL_H / 2, y + PILL_H / 2, x - w / 2 - 2, x + w / 2 + 2))) ?? 0;
    out.labels.push(pillLabel(`band-${dir}`, bandPill, clearAt, y));
  }

  // "Via {name}" at each block's junction, on the side of the incoming connector that is clear; with the
  // program the whole block shares when it fits (then the block's nodes leave it out).
  const programInCaption = new Set<string>();
  bandChunks.forEach(({ parent, first }, k) => {
    if (!first) return;
    const inX = junction.get(k);
    if (inX === undefined) return;
    const bus = bandRows[k].bus;
    const y = dir > 0 ? bus - 10 : bus + 10;
    const top = y - 8;
    const bottom = y + 8;
    const room = (toward: 1 | -1) => {
      const hits = segs.filter((v) => v.y0 < bottom && v.y1 > top && (toward > 0 ? v.x > inX + 0.5 : v.x < inX - 0.5)).map((v) => Math.abs(v.x - inX));
      return Math.min(CAPTION_W + 12, rowHalf - toward * inX, ...hits) - 12;
    };
    const right = room(1);
    const left = room(-1);
    const toward: 1 | -1 = right >= Math.min(left, 96) ? 1 : -1;
    const maxW = Math.max(48, toward > 0 ? right : left);
    const via = `Via ${names.get(parent) ?? ""}`;
    const shared = blockProgram.get(parent);
    const withProgram = shared ? `${via}${SEP}${shared}` : null;
    const fits = !!withProgram && textWidth(withProgram, 12) <= maxW;
    if (fits) programInCaption.add(parent);
    const text = fits ? withProgram : truncate(via, maxW, 12);
    out.labels.push(placeLabel(`via-${k}`, [{ text, tone: "muted" }], toward > 0 ? inX + 6 : inX - 6, y, toward > 0 ? "start" : "end", 3, 16));
  });

  bandChunks.forEach(({ parent, c }, k) =>
    c.forEach((b, j) => {
      const shared = programInCaption.has(parent) ? blockProgram.get(parent) : null;
      const program = shared && (b.program === shared || b.program === null) ? null : b.program;
      out.nodes.push(verticalNode({ ...b, program }, bandRows[k].xs[j], bandRows[k].cy, R2, "second"));
    }),
  );

  for (const n of out.nodes) names.set(n.key, n.fullName);
  return out;
}

export function layoutTree(input: DiagramInput, variant: LayoutVariant = "wide"): DiagramLayout {
  const geo = GEO[variant];
  const { focal } = input;
  const names = new Map<string, string>([[focal.key, focal.name]]);
  for (const m of [...input.mentors, ...input.peers, ...input.mentees]) names.set(m.key, m.name);

  // Peers: first half on the left, the rest on the right, each column centred on the focal coach.
  const nLeft = Math.ceil(input.peers.length / 2);
  const left = input.peers.slice(0, nLeft);
  const right = input.peers.slice(nLeft);
  const colHalfOf = (n: number) => (n ? ((n - 1) / 2) * PEER_PITCH + R1 + 6 : 0);
  const colHalf = Math.max(colHalfOf(left.length), colHalfOf(right.length));
  // The narrow layout puts the peer pill above the left column, so the rows above start higher.
  const peerPillTop = geo.peerPillAbove && input.peers.length && input.pills.peers ? colHalfOf(left.length) + 12 + PILL_H : 0;

  // Focal coach text, and the peer spine it sets (needed up front: labels may use the peers' width).
  const focalName = truncate(focal.name, geo.focalTextW, 14, 600);
  const focalTitle = focal.title ? truncate(focal.title, geo.focalTextW, 12) : null;
  const focalTextW = Math.max(textWidth(focalName, 14, 600), focalTitle ? textWidth(focalTitle, 12) : 0, 2 * RF);
  const peerPill = input.pills.peers ? pillLabel("peers", input.pills.peers, 0, 0) : null;
  const pillRoom = peerPill && !geo.peerPillAbove ? RF + 2 + PILL_PAD + peerPill.box.w + PILL_PAD : 0;
  const spine = Math.max(pillRoom, focalTextW / 2 + 16, variant === "wide" ? 150 : 104);
  const px = spine + STUB + R1;
  const minHalf = Math.max(280, input.peers.length ? px + R1 + 8 + geo.peerTextW + 6 : 0);

  const below = placeSide(1, input.mentees, input.down, input.pills.down, focal.key, colHalf, geo, names, minHalf);
  const above = placeSide(-1, input.mentors, input.up, input.pills.up, focal.key, Math.max(colHalf, peerPillTop), geo, names, minHalf);

  const focalNode: PlacedNode = {
    key: focal.key,
    slug: focal.slug,
    kind: "focal",
    cx: 0,
    cy: 0,
    r: RF,
    initials: initials(focal.name),
    tint: tintFor(focal.slug),
    name: focalName,
    fullName: focal.name,
    sub: null,
    programLine: null,
    titleLine: focalTitle,
    label: focal.label,
    you: !!focal.you,
    textAnchor: "middle",
    textX: 0,
    nameY: RF + 24,
    subY: RF + 42,
    nameSize: 14,
    ring: { x: -focalTextW / 2 - 8, y: -RF - 8, w: focalTextW + 16, h: FOCAL_BOTTOM + RF + 14 },
  };

  const nodes: PlacedNode[] = [focalNode, ...above.nodes];
  const edges: PlacedEdge[] = [...above.edges];
  const labels: PlacedLabel[] = [...above.labels];

  // Peer columns and their spines.
  if (input.peers.length) {
    const place = (list: DiagramMemberInput[], side: "left" | "right") => {
      const s = side === "left" ? -1 : 1;
      list.forEach((m, i) => {
        const cy = (i - (list.length - 1) / 2) * PEER_PITCH;
        const node = peerNode(m, s * px, cy, side, geo.peerTextW);
        nodes.push(node);
        edges.push({
          key: `${focal.key}>${m.key}`,
          ends: [focal.key, m.key],
          d: roundedPath([
            [s * (RF + 2), 0],
            [s * spine, 0],
            [s * spine, cy],
            [s * (px - R1 - 2), cy],
          ]),
        });
      });
    };
    place(left, "left");
    place(right, "right");
    if (peerPill && input.pills.peers) {
      if (geo.peerPillAbove) {
        // Above the left column, its right edge on the spine, clear of the focal coach.
        const top = -colHalfOf(left.length);
        labels.push(pillLabel("peers", input.pills.peers, -spine - 4, top - 6 - PILL_H / 2, "end"));
      } else {
        labels.push(pillLabel("peers", input.pills.peers, -(RF + 2 + spine) / 2, 0));
      }
    }
  }

  nodes.push(...below.nodes);
  edges.push(...below.edges);
  labels.push(...below.labels);

  if (input.pills.mentors && above.bus0 !== null) labels.push(pillLabel("mentors", input.pills.mentors, 0, (-RF + above.bus0) / 2));
  if (input.pills.mentees && below.bus0 !== null) labels.push(pillLabel("mentees", input.pills.mentees, 0, (FOCAL_BOTTOM + below.bus0) / 2));

  // Canvas: keep the focal coach on the vertical centre line.
  let minY = Infinity;
  let maxY = -Infinity;
  let half = 0;
  for (const n of nodes) {
    minY = Math.min(minY, n.ring.y);
    maxY = Math.max(maxY, n.ring.y + n.ring.h);
    half = Math.max(half, Math.abs(n.ring.x), Math.abs(n.ring.x + n.ring.w));
  }
  for (const l of labels) {
    minY = Math.min(minY, l.box.y);
    maxY = Math.max(maxY, l.box.y + l.box.h);
    half = Math.max(half, Math.abs(l.box.x), Math.abs(l.box.x + l.box.w));
  }
  half += MARGIN;
  return {
    width: Math.ceil(2 * half),
    height: Math.ceil(maxY - minY + 2 * MARGIN),
    tx: half,
    ty: -minY + MARGIN,
    nodes,
    edges,
    labels,
  };
}
