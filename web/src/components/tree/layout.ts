import { initials, tintFor, titleShort, type Tint } from "@/lib/format";
import { textWidth, truncate, wrapName } from "./metrics";
import type { RangePart } from "./years";

/*
 * Layered layout for the coaching tree diagram (DESIGN.md §8.8). Pure geometry, no physics:
 *
 *   two steps up            (depth 2, small nodes, blocks under the coach they connect through)
 *   worked under            (rows of 6; 4 in the narrow layout)
 *   alongside · FOCAL · alongside
 *   coached under {first}   (rows of 6; 4 in the narrow layout, in the profile card's order)
 *   two steps down          (depth 2)
 *
 * Two variants share the code: "wide" (lg, rows of 6) and "narrow" (md and phone, rows of 4, narrower
 * peer columns with their label above the left column).
 *
 * Edges are org-chart connectors with rounded corners: a trunk from the focal coach to a bus line in the
 * gap above (or below) each row, then a short drop to the node. Rows the trunk passes through keep their
 * nodes on half-pitch offsets, so the trunk runs through a gap between labels.
 *
 * Second level: each first-level coach's people form a block centred under that coach. Blocks of coaches
 * in the outermost row that fit side by side share the first band row, in the order of their coaches, and
 * hang straight down from them. Every other block gets its own lane in the gutter just outside the rows, on
 * its coach's side: the connector leaves the coach in the gap below its row, runs out to the lane and
 * along it to the block. Lanes nest (the block whose coach is nearest the band, then nearest the centre,
 * takes the innermost lane and the first band rows), so no two coaches' connectors share or cross a
 * segment, and none crosses another row's bus line. Each block's caption sits on its own connector:
 * "Two steps down · 17 · Via Spencer Crace · George Fox".
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
  /** Program to show with the range, only where it adds something. */
  program: string | null;
  range: DiagramRange;
  /** Accessible name of the profile link (name, title and the relationship in words). */
  label: string;
  /** The signed-in viewer: an Iris ring around the avatar (the viewer's own row in a chart), named in the legend. */
  you?: boolean;
};

export type DiagramSecondInput = DiagramMemberInput & {
  /** First-level coaches (node keys) this person connects through, the block's coach first, each with the program where they overlapped. */
  parents: { key: string; program: string }[];
};

export type DiagramPill = { text: string; count: number; extra?: string | null };

/** A second-level band: its group label and how many people connect through each first-level coach (node key). */
export type DiagramBand = { label: string; counts: Record<string, number> };

export type DiagramInput = {
  focal: { key: string; slug: string; name: string; title: string | null; label: string; you?: boolean };
  mentors: DiagramMemberInput[];
  peers: DiagramMemberInput[];
  mentees: DiagramMemberInput[];
  up: DiagramSecondInput[];
  down: DiagramSecondInput[];
  pills: { mentors: DiagramPill | null; peers: DiagramPill | null; mentees: DiagramPill | null };
  bands: { up: DiagramBand | null; down: DiagramBand | null };
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
  /** The name in one or two lines (never cut); `fullName` is the name as one string. */
  nameLines: string[];
  fullName: string;
  /** Optional program · compact range (the range is never truncated). */
  sub: PlacedSub | null;
  /** The program on its own line, when the row gives programs a line. */
  programLine: { text: string; y: number } | null;
  /** The focal coach's current title (abbreviated, then truncated only if it still doesn't fit). */
  titleLine: { text: string; y: number } | null;
  label: string;
  you: boolean;
  textAnchor: "middle" | "start" | "end";
  textX: number;
  /** Baseline of the first name line; further lines follow at `lineHeight`. */
  nameY: number;
  lineHeight: number;
  subY: number;
  nameSize: number;
  /** Focus ring and hover area. */
  ring: { x: number; y: number; w: number; h: number };
};

type Pt = [number, number];

/** One connector; `ends` are the node keys whose hover or focus highlights it; `pts` is its polyline. */
export type PlacedEdge = { key: string; ends: string[]; d: string; pts: Pt[] };

/** A label sitting on the connectors: group pills (with their count) and the band captions. */
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

/** What the SVG renders of a layout: the connectors' path strings, not their point lists. */
export type ClientLayout = Omit<DiagramLayout, "edges"> & { edges: Omit<PlacedEdge, "pts">[] };

/** A layout stripped to what the SVG renders (it crosses to the client component once, as data). */
export function toClientLayout(layout: DiagramLayout): ClientLayout {
  return { ...layout, edges: layout.edges.map(({ key, ends, d }) => ({ key, ends, d })) };
}

/* ---------- Geometry ---------- */

export const PITCH = 148; // slot width of a node in a row
const LABEL_W = 132; // max text width under a node in a row a lane runs through (8px clearance each side of it)
const LABEL_W_OPEN = 140; // in a row no lane runs through: 8px between neighbouring labels
const R1 = 20; // first level: avatar 40
const R2 = 16; // second level: avatar 32
const RF = 32; // focal: avatar 64
const LINE = 16; // 12px text lines
const ROW_GAP = 44;
const BAND_GAP = 68; // last first-level row → first band row: room for the jogs and a caption
const BLOCK_GAP = 56; // a band row that starts a block: room for its caption
const BUS_INSET = 22; // bus line distance from the row it feeds
const JOG_ZONE = 22; // jogs to a gutter lane sit within this distance past the coach's row
const GUTTER_STEP = 12; // between nested gutter lanes
const STUB = 16; // spine → peer avatar
const PILL_PAD = 14;
const PILL_H = 20;
const CAPTION_H = 16;
const MARGIN = 8;
const SEP = " · ";

type Geo = { perRow: number; focalTextW: number; peerTextW: number; peerPillAbove: boolean };
const GEO: Record<LayoutVariant, Geo> = {
  wide: { perRow: 6, focalTextW: 240, peerTextW: 148, peerPillAbove: false },
  narrow: { perRow: 4, focalTextW: 184, peerTextW: 100, peerPillAbove: true },
};

/** Text height under an avatar: a 6px gap, the lines, 2px. */
const below = (lines: number) => 8 + LINE * lines;

const partsWidth = (parts: RangePart[]) => parts.reduce((w, p) => w + textWidth(p.text, 12, 500, true), 0);

/* ---------- Paths ---------- */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Points without repeats or collinear middles. */
function simplify(points: Pt[]): Pt[] {
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
  return pts;
}

/** An axis-aligned polyline with rounded corners (radius clamped to half of each segment). */
export function roundedPath(points: Pt[], radius = 10): string {
  const pts = simplify(points);
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

const edge = (key: string, ends: string[], pts: Pt[]): PlacedEdge => {
  const s = simplify(pts);
  return { key, ends, d: roundedPath(s), pts: s };
};

/** Axis-aligned segments of a polyline, for keeping captions off the connectors. */
type Seg = { x0: number; x1: number; y0: number; y1: number };
export function segments(points: Pt[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    out.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by) });
  }
  return out;
}

/* ---------- Rows ---------- */

type Row = { cy: number; top: number; bottom: number; bus: number; near: number; far: number; jogZone?: number };

/** A row `gap` past `cursor` (the previous row's far edge) in direction `dir`, `lines` of text under avatars of radius r. */
function stackRow(dir: 1 | -1, cursor: number, gap: number, r: number, lines: number): Row {
  if (dir > 0) {
    const top = cursor + gap;
    const cy = top + r;
    const bottom = cy + r + below(lines);
    return { cy, top, bottom, bus: top - BUS_INSET, near: top, far: bottom };
  }
  const bottom = cursor - gap;
  const cy = bottom - below(lines) - r;
  const top = cy - r;
  return { cy, top, bottom, bus: bottom + BUS_INSET, near: bottom, far: top };
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/* ---------- Node text ---------- */

/** What a node's text needs, before it is placed: name lines, program (beside the range or on its own line), range. */
type NodeText = { nameLines: string[]; program: string | null; ownLine: boolean; parts: RangePart[]; title: string | null; lines: number };

const rangeParts = (m: DiagramMemberInput, maxW: number) => (m.range.short && partsWidth(m.range.parts) > maxW ? m.range.short : m.range.parts);

/** The program can't sit beside the range: the row gives programs their own line. */
function needsOwnLine(m: DiagramMemberInput, maxW: number): boolean {
  if (!m.program) return false;
  return textWidth(m.program + SEP, 12) + partsWidth(rangeParts(m, maxW)) > maxW;
}

function nodeText(m: DiagramMemberInput, maxW: number, ownLine: boolean): NodeText {
  const nameLines = wrapName(m.name, maxW, 12, 600);
  const parts = rangeParts(m, maxW);
  const own = ownLine && !!m.program;
  const program = m.program ? (own ? truncate(m.program, maxW, 12) : m.program) : null;
  const sub = parts.length > 0 || (!!program && !own);
  return { nameLines, program, ownLine: own, parts, title: m.range.title, lines: nameLines.length + (own ? 1 : 0) + (sub ? 1 : 0) };
}

/** Per row (or peer column): when one node needs a program line, every node with a program gets one. */
function rowTexts(list: DiagramMemberInput[], maxW: number): NodeText[] {
  const own = list.some((m) => needsOwnLine(m, maxW));
  return list.map((m) => nodeText(m, maxW, own));
}

/** The second line: program · range (or either alone), with marks under inferred pieces. */
function subLine(t: NodeText, anchor: "middle" | "start" | "end", textX: number, subY: number): { sub: PlacedSub | null; width: number } {
  const program = t.ownLine ? null : t.program;
  if (!program && !t.parts.length) return { sub: null, width: 0 };
  const rw = partsWidth(t.parts);
  const lead = program ? textWidth(program + (t.parts.length ? SEP : ""), 12) : 0;
  const width = lead + rw;
  const x0 = anchor === "middle" ? textX - width / 2 : anchor === "start" ? textX : textX - width;
  const marks: PlacedSub["marks"] = [];
  let at = x0 + lead;
  t.parts.forEach((p, i) => {
    const w = textWidth(p.text, 12, 500, true);
    if (p.inferred) marks.push({ part: i, x: at, w });
    at += w;
  });
  const hit = t.title && rw > 0 ? { x: x0 + lead - 2, y: subY - 12, w: rw + 4, h: 18 } : null;
  return { sub: { program, parts: t.parts, marks, hit, title: t.title }, width };
}

const textBlockWidth = (t: NodeText, subWidth: number) =>
  Math.max(...t.nameLines.map((l) => textWidth(l, 12, 600)), subWidth, t.ownLine && t.program ? textWidth(t.program, 12) : 0);

/** A node in a row: avatar, then its name (one or two lines), the program line if any, and program · range. */
function verticalNode(m: DiagramMemberInput, t: NodeText, cx: number, cy: number, r: number, kind: "member" | "second"): PlacedNode {
  const nameY = cy + r + 18;
  let y = nameY + LINE * t.nameLines.length;
  const programLine = t.ownLine && t.program ? { text: t.program, y } : null;
  if (programLine) y += LINE;
  const { sub, width } = subLine(t, "middle", cx, y);
  const textW = Math.max(textBlockWidth(t, width), 2 * r);
  return {
    key: m.key,
    slug: m.slug,
    kind,
    cx,
    cy,
    r,
    initials: initials(m.name),
    tint: tintFor(m.slug),
    nameLines: t.nameLines,
    fullName: m.name,
    sub,
    programLine,
    titleLine: null,
    label: m.label,
    you: !!m.you,
    textAnchor: "middle",
    textX: cx,
    nameY,
    lineHeight: LINE,
    subY: y,
    nameSize: 12,
    ring: { x: cx - textW / 2 - 6, y: cy - r - 6, w: textW + 12, h: 2 * r + below(t.lines) + 8 },
  };
}

/** Half the height a peer's avatar or text block needs around its centre. */
const peerHalf = (t: NodeText) => Math.max(R1, (LINE * t.lines) / 2 + 2);

function peerNode(m: DiagramMemberInput, t: NodeText, cx: number, cy: number, side: "left" | "right"): PlacedNode {
  const left = side === "left";
  const anchor = left ? "end" : "start";
  const textX = left ? cx - R1 - 8 : cx + R1 + 8;
  // The text block is centred on the avatar: two lines sit at cy − 3 and cy + 13, each extra line moves it up 8px.
  const nameY = cy - 3 - 8 * (t.lines - 2);
  let y = nameY + LINE * t.nameLines.length;
  const programLine = t.ownLine && t.program ? { text: t.program, y } : null;
  if (programLine) y += LINE;
  const { sub, width } = subLine(t, anchor, textX, y);
  const textW = textBlockWidth(t, width);
  const half = peerHalf(t);
  return {
    key: m.key,
    slug: m.slug,
    kind: left ? "peer-left" : "peer-right",
    cx,
    cy,
    r: R1,
    initials: initials(m.name),
    tint: tintFor(m.slug),
    nameLines: t.nameLines,
    fullName: m.name,
    sub,
    programLine,
    titleLine: null,
    label: m.label,
    you: !!m.you,
    textAnchor: anchor,
    textX,
    nameY,
    lineHeight: LINE,
    subY: y,
    nameSize: 12,
    ring: left
      ? { x: textX - textW - 6, y: cy - half - 6, w: textW + 8 + 2 * R1 + 12, h: 2 * half + 12 }
      : { x: cx - R1 - 6, y: cy - half - 6, w: 2 * R1 + 8 + textW + 12, h: 2 * half + 12 },
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

const partsTextWidth = (parts: PlacedLabel["parts"]) => parts.reduce((s, p) => s + textWidth(p.text, 12, p.tone === "muted" ? 400 : 500, p.tone === "count"), 0);

function placeLabel(key: string, parts: PlacedLabel["parts"], x: number, y: number, anchor: PlacedLabel["anchor"], pad: number, h = PILL_H): PlacedLabel {
  const w = partsTextWidth(parts);
  const left = anchor === "middle" ? x - w / 2 : anchor === "start" ? x : x - w;
  return { key, x, y, anchor, parts, box: { x: left - pad, y: y - h / 2, w: w + 2 * pad, h } };
}

/* ---------- Second-level band ---------- */

type Block = {
  parent: string;
  members: DiagramSecondInput[];
  /** The coach's position: x, row index and order among the coach's people. */
  px: number;
  prow: number;
  pindex: number;
  kind: "direct" | "gutter";
  side: 1 | -1;
  lane: number;
  jog: number;
};

type BandItem = { block: Block; chunk: DiagramSecondInput[]; chunkIndex: number; xs: number[] };

/** Bus extent of an item in its row: its nodes plus where its connector comes in. */
function busExtent(it: Omit<BandItem, "xs">, xs: number[]): [number, number] {
  const lo = xs[0];
  const hi = xs[xs.length - 1];
  if (it.block.kind === "gutter") return it.block.side > 0 ? [lo, Infinity] : [-Infinity, hi];
  return [Math.min(lo, it.block.px), Math.max(hi, it.block.px)];
}

/**
 * Node positions for the items sharing one band row, in their order (left gutter block, direct blocks
 * by their coach's x, right gutter block): each centred under its coach as far as the row allows, kept
 * in order with an empty slot between blocks when it fits. Null when they can't share: too many nodes,
 * a coach that would end up more than one column from its block, or bus lines that would touch.
 */
function positionRow(items: Omit<BandItem, "xs">[], perRow: number): number[][] | null {
  const n = items.map((it) => it.chunk.length);
  const total = n.reduce((a, b) => a + b, 0);
  if (total > perRow) return null;
  const bound = ((perRow - 1) / 2) * PITCH;
  const half = PITCH / 2;
  const gaps = total + items.length - 1 <= perRow ? [1, 0] : [0];
  for (const g of gaps) {
    const x = items.map((it, i) => {
      const want = Math.round((it.block.px - ((n[i] - 1) / 2) * PITCH) / half) * half;
      return Math.min(Math.max(want, -bound), bound - (n[i] - 1) * PITCH);
    });
    for (let i = 1; i < x.length; i++) x[i] = Math.max(x[i], x[i - 1] + (n[i - 1] + g) * PITCH);
    const last = x.length - 1;
    x[last] = Math.min(x[last], bound - (n[last] - 1) * PITCH);
    for (let i = last - 1; i >= 0; i--) x[i] = Math.min(x[i], x[i + 1] - (n[i] + g) * PITCH);
    if (x[0] < -bound - 0.5) continue;
    const xs = items.map((_, i) => Array.from({ length: n[i] }, (_, j) => x[i] + j * PITCH));
    const extents = items.map((it, i) => busExtent(it, xs[i]));
    const separated = extents.every((e, i) => i === 0 || e[0] - extents[i - 1][1] >= 24);
    const underCoach = items.every((it, i) => it.chunkIndex > 0 || it.block.kind === "gutter" || (it.block.px >= xs[i][0] - PITCH && it.block.px <= xs[i][n[i] - 1] + PITCH));
    if (separated && underCoach) return xs;
  }
  return null;
}

/** Order inside a shared row: left gutter block, direct blocks by their coach's x, right gutter block. */
const rowOrder = (a: Omit<BandItem, "xs">, b: Omit<BandItem, "xs">) => {
  const k = (it: Omit<BandItem, "xs">) => (it.block.kind === "gutter" ? it.block.side * 1e6 : it.block.px);
  return k(a) - k(b);
};

/* ---------- Layout ---------- */

type Side = { nodes: PlacedNode[]; edges: PlacedEdge[]; labels: PlacedLabel[]; bus0: number | null };

type SideCtx = {
  dir: 1 | -1;
  level1: DiagramMemberInput[];
  band: DiagramSecondInput[];
  bandInfo: DiagramBand | null;
  focalKey: string;
  focalEdge: number;
  /** First bus line at least this far from the focal centre (clears the focal text and the peer columns). */
  firstBus: number;
  geo: Geo;
  names: Map<string, string>;
  /** Half-width the content already needs: captions stay inside it when they can. */
  contentHalf: number;
};

/** One side of the focal coach (dir 1 = below, −1 = above): the first-level rows, then the second-level band. */
function placeSide(ctx: SideCtx): Side {
  const { dir, level1, band, geo, focalKey } = ctx;
  const out: Side = { nodes: [], edges: [], labels: [], bus0: null };
  if (!level1.length) return out;
  const perRow = geo.perRow;

  const offsets = (n: number, laneSafe: boolean): number[] => {
    // A row the trunk passes through keeps whole-pitch offsets free (an odd count shifts half a pitch).
    if (laneSafe && n % 2 === 1) {
      const start = Math.floor((perRow - n) / 2);
      return Array.from({ length: n }, (_, i) => start + i - (perRow - 1) / 2);
    }
    return Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
  };

  // First level, in the profile card's order.
  const chunks = chunk(level1, perRow);
  const rowXs = chunks.map((c, i) => offsets(c.length, i < chunks.length - 1).map((o) => o * PITCH));
  // Coaches with second-level blocks in a row the trunk passes through turn out to gutter lanes in the gap
  // below it; that gap grows when several turn out on one side, so their jogs stay 8px or more apart.
  const parentKeys = new Set(band.map((b) => b.parents[0]?.key));
  const jogRoom = chunks.map((c, i) => {
    if (i === chunks.length - 1) return 0;
    const perSide = [-1, 1].map((s) => c.filter((m, j) => parentKeys.has(m.key) && Math.sign(rowXs[i][j]) === s).length);
    return 8 * Math.max(0, ...perSide.map((k) => k - 1));
  });
  const rows: Row[] = [];
  const where = new Map<string, { row: number; x: number; index: number }>();
  let cursor = ctx.firstBus - dir * BUS_INSET;
  chunks.forEach((c, i) => {
    // The trunk runs through every row but the outermost; that one can give labels the full slot.
    const texts = rowTexts(c, i < chunks.length - 1 ? LABEL_W : LABEL_W_OPEN);
    const row = { ...stackRow(dir, cursor, ROW_GAP + (i > 0 ? jogRoom[i - 1] : 0), R1, Math.max(...texts.map((t) => t.lines))), jogZone: JOG_ZONE + jogRoom[i] };
    rows.push(row);
    cursor = row.far;
    const xs = rowXs[i];
    c.forEach((m, j) => {
      where.set(m.key, { row: i, x: xs[j], index: i * perRow + j });
      out.nodes.push(verticalNode(m, texts[j], xs[j], row.cy, R1, "member"));
      out.edges.push(
        edge(`${focalKey}>${m.key}`, [focalKey, m.key], [
          [0, ctx.focalEdge],
          [0, row.bus],
          [xs[j], row.bus],
          [xs[j], row.near],
        ]),
      );
    });
  });
  out.bus0 = rows[0].bus;
  for (const n of out.nodes) ctx.names.set(n.key, n.fullName);
  if (!band.length) return out;

  const result = placeBand(ctx, rows, where, cursor, new Set());
  const retry = result.programless.size ? placeBand(ctx, rows, where, cursor, result.programless) : result;
  out.nodes.push(...retry.nodes);
  out.edges.push(...retry.edges);
  out.labels.push(...retry.labels);
  return out;
}

/**
 * The second-level band below (or above) the first-level rows. `keepPrograms`: blocks whose caption
 * could not carry their shared program, so their nodes show it (the second pass).
 */
function placeBand(
  ctx: SideCtx,
  rows: Row[],
  where: Map<string, { row: number; x: number; index: number }>,
  zoneStart: number,
  keepPrograms: Set<string>,
): { nodes: PlacedNode[]; edges: PlacedEdge[]; labels: PlacedLabel[]; programless: Set<string> } {
  const { dir, geo } = ctx;
  const perRow = geo.perRow;
  const lastRow = rows.length - 1;
  const bound = ((perRow - 1) / 2) * PITCH;

  // One block per first-level coach: everyone whose first (most recent) link runs through them.
  const grouped = new Map<string, DiagramSecondInput[]>();
  for (const b of ctx.band) {
    const p = b.parents.find((q) => where.has(q.key));
    if (p) grouped.set(p.key, [...(grouped.get(p.key) ?? []), b]);
  }
  const blocks = [...grouped.entries()]
    .map(([parent, members]): Block => {
      const at = where.get(parent)!;
      return { parent, members, px: at.x, prow: at.row, pindex: at.index, kind: "direct", side: 1, lane: 0, jog: 0 };
    })
    .sort((a, b) => a.pindex - b.pindex);

  // Coaches in the outermost row hang their blocks straight down, side by side, when they fit in one
  // row (a single block may run over several rows); the outermost coach moves to a gutter lane until they do.
  let direct = blocks.filter((b) => b.prow === lastRow).sort((a, b) => a.px - b.px);
  while (direct.length > 1 && !positionRow(direct.map((block) => ({ block, chunk: block.members, chunkIndex: 0 })), perRow)) {
    const outer = direct.reduce((a, b) => (Math.abs(b.px) >= Math.abs(a.px) ? b : a));
    direct = direct.filter((b) => b !== outer);
  }
  for (const b of blocks) b.kind = direct.includes(b) ? "direct" : "gutter";
  const gutter = blocks.filter((b) => b.kind === "gutter");

  // Gutter lanes: each side nests its lanes; the coach nearest the band (then nearest the centre) is innermost.
  const leftCount = gutter.filter((b) => b.px < 0).length;
  const rightCount = gutter.filter((b) => b.px > 0).length;
  for (const b of gutter) b.side = b.px < 0 ? -1 : b.px > 0 ? 1 : leftCount < rightCount ? -1 : 1;
  const bySide = ([-1, 1] as const).map((s) =>
    gutter.filter((b) => b.side === s).sort((a, b) => b.prow - a.prow || Math.abs(a.px) - Math.abs(b.px) || a.pindex - b.pindex),
  );
  const gutterBase = bound + LABEL_W_OPEN / 2 + 8;
  for (const list of bySide) list.forEach((b, j) => (b.lane = b.side * (gutterBase + j * GUTTER_STEP)));
  // Jogs out to the lanes: in the gap past the coach's row; the coach with the outer lane turns first.
  const jogGroups = new Map<string, Block[]>();
  for (const b of gutter) jogGroups.set(`${b.prow}:${b.side}`, [...(jogGroups.get(`${b.prow}:${b.side}`) ?? []), b]);
  for (const list of jogGroups.values()) {
    list.sort((a, b) => Math.abs(a.lane) - Math.abs(b.lane));
    const zone = rows[list[0].prow].jogZone ?? JOG_ZONE;
    list.forEach((b, i) => (b.jog = rows[b.prow].far + (dir * zone * (list.length - i)) / (list.length + 1)));
  }

  // Band rows: the direct blocks first, then the gutter blocks, inner lanes first on each side (merged in
  // the coaches' order). A small gutter block may join the row before it when it fits on its own side.
  type RowSpec = { items: Omit<BandItem, "xs">[]; xs: number[][]; shareable: boolean };
  const specs: RowSpec[] = [];
  const addOwnRows = (block: Block) => {
    chunk(block.members, perRow).forEach((c, i, all) => {
      const item = { block, chunk: c, chunkIndex: i };
      specs.push({ items: [item], xs: positionRow([item], perRow)!, shareable: all.length === 1 });
    });
  };
  if (direct.length === 1 && direct[0].members.length > perRow) addOwnRows(direct[0]);
  else if (direct.length) {
    const items = direct.map((block) => ({ block, chunk: block.members, chunkIndex: 0 }));
    specs.push({ items, xs: positionRow(items, perRow)!, shareable: true });
  }
  const queues = bySide.map((l) => [...l]);
  while (queues[0].length || queues[1].length) {
    const pick = !queues[0].length ? 1 : !queues[1].length ? 0 : queues[0][0].pindex <= queues[1][0].pindex ? 0 : 1;
    const block = queues[pick].shift()!;
    const last = specs[specs.length - 1];
    if (last?.shareable && block.members.length <= perRow && !last.items.some((it) => it.block.kind === "gutter" && it.block.side === block.side)) {
      const items = [...last.items, { block, chunk: block.members, chunkIndex: 0 }].sort(rowOrder);
      const xs = positionRow(items, perRow);
      if (xs) {
        last.items = items;
        last.xs = xs;
        continue;
      }
    }
    addOwnRows(block);
  }

  // Shared programs go in the caption (first pass), so the nodes leave them out.
  const blockProgram = new Map(
    blocks.map((b) => {
      const programs = b.members.map((m) => m.parents.find((p) => p.key === b.parent)?.program ?? "");
      return [b.parent, programs.every((x) => x && x === programs[0]) ? programs[0] : null] as const;
    }),
  );
  const captionProgram = (parent: string) => (keepPrograms.has(parent) ? null : blockProgram.get(parent) ?? null);

  // Rows, nodes. A block over several rows runs its lane down through all but its last row: those rows keep
  // labels clear of the lane.
  const laned = new Set<number>();
  for (const b of blocks) {
    const ks = specs.flatMap((spec, k) => (spec.items.some((it) => it.block === b) ? [k] : []));
    ks.slice(0, -1).forEach((k) => laned.add(k));
  }
  const nodes: PlacedNode[] = [];
  const bandRows: Row[] = [];
  let cursor = zoneStart;
  specs.forEach((spec, k) => {
    const entries = spec.items.flatMap((it) =>
      it.chunk.map((m) => {
        const shared = captionProgram(it.block.parent);
        return shared && (m.program === shared || m.program === null) ? { ...m, program: null } : m;
      }),
    );
    const texts = rowTexts(entries, laned.has(k) ? LABEL_W : LABEL_W_OPEN);
    const gap = k === 0 ? BAND_GAP : spec.items.some((it) => it.chunkIndex === 0) ? BLOCK_GAP : ROW_GAP;
    const row = stackRow(dir, cursor, gap, R2, Math.max(...texts.map((t) => t.lines)));
    bandRows.push(row);
    cursor = row.far;
    let e = 0;
    spec.items.forEach((it, i) =>
      it.chunk.forEach((_, j) => {
        nodes.push(verticalNode(entries[e], texts[e], spec.xs[i][j], row.cy, R2, "second"));
        e++;
      }),
    );
  });

  // Connectors. A block that runs over several rows continues down one interior lane from its first row's bus.
  const edges: PlacedEdge[] = [];
  const firstRow = new Map<string, number>();
  specs.forEach((spec, k) => spec.items.forEach((it) => it.chunkIndex === 0 && firstRow.set(it.block.parent, k)));
  const contLane = new Map<string, number>();
  specs.forEach((spec, k) =>
    spec.items.forEach((it, i) => {
      const { block } = it;
      const farP = rows[block.prow].far;
      const k0 = firstRow.get(block.parent)!;
      const entry: Pt[] =
        block.kind === "direct"
          ? [
              [block.px, farP],
              [block.px, bandRows[k0].bus],
            ]
          : [
              [block.px, farP],
              [block.px, block.jog],
              [block.lane, block.jog],
              [block.lane, bandRows[k0].bus],
            ];
      let via: Pt[] = [];
      if (it.chunkIndex > 0) {
        if (!contLane.has(block.parent)) {
          const lastSpec = [...specs].reverse().find((s) => s.items.some((x) => x.block === block))!;
          const lastXs = lastSpec.xs[lastSpec.items.findIndex((x) => x.block === block)];
          const centre = (lastXs[0] + lastXs[lastXs.length - 1]) / 2;
          const inner = (perRow / 2 - 1) * PITCH;
          contLane.set(block.parent, Math.min(Math.max(Math.round(centre / PITCH) * PITCH, -inner), inner));
        }
        const lane = contLane.get(block.parent)!;
        via = [
          [lane, bandRows[k0].bus],
          [lane, bandRows[k].bus],
        ];
      }
      it.chunk.forEach((b, j) => {
        const xc = spec.xs[i][j];
        edges.push(edge(`${block.parent}>${b.key}`, [block.parent, b.key], [...entry, ...via, [xc, bandRows[k].bus], [xc, bandRows[k].near]]));
      });
    }),
  );

  // Captions, on each block's own connector: "Two steps down · 17 · Via Spencer Crace · George Fox".
  // Never a cut name: the program goes first, then the group and count; then the other side.
  const segs = edges.flatMap((e) => segments(e.pts));
  const labels: PlacedLabel[] = [];
  const programless = new Set<string>();
  const info = ctx.bandInfo;
  for (const spec of specs) {
    for (const it of spec.items) {
      if (it.chunkIndex > 0) continue;
      const { block } = it;
      const k = firstRow.get(block.parent)!;
      const y = bandRows[k].bus - dir * 10;
      const name = ctx.names.get(block.parent) ?? "";
      const program = captionProgram(block.parent);
      const count = info?.counts[block.parent] ?? block.members.length;
      const head: PlacedLabel["parts"] = info ? [{ text: info.label, tone: "strong" }, { text: `${SEP}${count}`, tone: "count" }] : [];
      const viaText = `${head.length ? SEP : ""}Via ${name}`;
      const variants: PlacedLabel["parts"][] = [
        ...(program ? [[...head, { text: `${viaText}${SEP}${program}`, tone: "muted" as const }]] : []),
        [...head, { text: viaText, tone: "muted" }],
        [{ text: `Via ${name}`, tone: "muted" }],
      ];
      const ax = block.kind === "gutter" ? block.lane : block.px;
      // Free run from the anchor toward one side, inside the caption's band (which stops short of the bus line).
      const room = (toward: 1 | -1) => {
        const top = y - CAPTION_H / 2 - 1;
        const bottom = y + CAPTION_H / 2 + 1;
        let limit = toward > 0 ? ctx.contentHalf - ax : ax + ctx.contentHalf;
        for (const s of segs) {
          if (s.y1 < top || s.y0 > bottom) continue;
          const near = toward > 0 ? s.x0 - ax : ax - s.x1;
          const far = toward > 0 ? s.x1 - ax : ax - s.x0;
          if (far <= 0.5) continue; // behind the anchor, or the connector the caption sits on
          limit = Math.min(limit, Math.max(0, near));
        }
        for (const l of labels) {
          if (l.box.y + l.box.h < top || l.box.y > bottom) continue;
          const d = toward > 0 ? l.box.x - ax : ax - (l.box.x + l.box.w);
          if (d > 0) limit = Math.min(limit, d);
        }
        return limit - 12;
      };
      let sides: (1 | -1)[];
      if (block.kind === "gutter") sides = [block.side > 0 ? -1 : 1];
      else {
        const xs = spec.xs[spec.items.indexOf(it)];
        const centre = (xs[0] + xs[xs.length - 1]) / 2;
        const pref: 1 | -1 = centre < block.px - 1 ? -1 : centre > block.px + 1 ? 1 : room(1) >= room(-1) ? 1 : -1;
        sides = [pref, pref > 0 ? -1 : 1];
      }
      let chosen: { parts: PlacedLabel["parts"]; toward: 1 | -1 } | null = null;
      for (const toward of sides) {
        const r = room(toward);
        const fit = variants.find((v) => partsTextWidth(v) <= r);
        if (fit) {
          chosen = { parts: fit, toward };
          break;
        }
      }
      if (!chosen) chosen = { parts: variants[variants.length - 1], toward: sides.length > 1 && room(sides[1]) > room(sides[0]) ? sides[1] : sides[0] };
      if (program && chosen.parts !== variants[0]) programless.add(block.parent);
      const x = ax + chosen.toward * 6;
      labels.push(placeLabel(`via-${dir}-${block.parent}`, chosen.parts, x, y, chosen.toward > 0 ? "start" : "end", 3, CAPTION_H));
    }
  }
  // A caption that dropped its shared program forces a second pass in which the nodes show it.
  const missing = new Set([...programless].filter((p) => !keepPrograms.has(p)));
  return { nodes, edges, labels, programless: missing };
}

export function layoutTree(input: DiagramInput, variant: LayoutVariant = "wide"): DiagramLayout {
  const geo = GEO[variant];
  const { focal } = input;
  const names = new Map<string, string>([[focal.key, focal.name]]);
  for (const m of [...input.mentors, ...input.peers, ...input.mentees]) names.set(m.key, m.name);

  // Peers: first half on the left, the rest on the right, each column centred on the focal coach. A column
  // whose labels run to three or four lines spaces its people further apart, so 12px or more of air
  // separates one person's text from the next.
  const nLeft = Math.ceil(input.peers.length / 2);
  const left = input.peers.slice(0, nLeft);
  const right = input.peers.slice(nLeft);
  const leftTexts = rowTexts(left, geo.peerTextW);
  const rightTexts = rowTexts(right, geo.peerTextW);
  const allTexts = [...leftTexts, ...rightTexts];
  const peerPitch = allTexts.length ? Math.max(52, ...allTexts.map((t) => LINE * t.lines + 20)) : 52;
  const colHalfOf = (texts: NodeText[]) => (texts.length ? ((texts.length - 1) / 2) * peerPitch + Math.max(...texts.map(peerHalf)) + 6 : 0);
  const colHalfL = colHalfOf(leftTexts);
  const colHalf = Math.max(colHalfL, colHalfOf(rightTexts));
  // The narrow layout puts the peer pill above the left column, so the rows above start higher.
  const peerPillTop = geo.peerPillAbove && input.peers.length && input.pills.peers ? colHalfL + 12 + PILL_H : 0;

  // Focal coach: the name in one or two lines, then the title (abbreviated first; cut only if still too long).
  const focalName = wrapName(focal.name, geo.focalTextW, 14, 600);
  const fitsTitle = (t: string) => textWidth(t, 12) <= geo.focalTextW;
  const focalTitle = !focal.title
    ? null
    : [titleShort(focal.title), titleShort(focal.title, 0)].find(fitsTitle) ?? truncate(titleShort(focal.title, 0), geo.focalTextW, 12);
  const focalNameY = RF + 24;
  const focalTitleY = focalNameY + 18 * focalName.length;
  const focalBottom = (focalTitle ? focalTitleY : focalTitleY - 18) + 6;
  const focalTextW = Math.max(...focalName.map((l) => textWidth(l, 14, 600)), focalTitle ? textWidth(focalTitle, 12) : 0, 2 * RF);
  const peerPill = input.pills.peers ? pillLabel("peers", input.pills.peers, 0, 0) : null;
  // The wide layout's peer pill sits on the spine, clear of the focal coach's hover area (as wide as its text).
  const focalHalf = focalTextW / 2 + 8;
  const pillRoom = peerPill && !geo.peerPillAbove ? focalHalf + PILL_PAD + peerPill.box.w + PILL_PAD : 0;
  const spine = Math.max(pillRoom, focalTextW / 2 + 16, variant === "wide" ? 150 : 104);
  const px = spine + STUB + R1;
  const peerHalfW = input.peers.length ? px + R1 + 8 + geo.peerTextW + 6 : 0;
  const contentHalf = Math.max(280, peerHalfW, ((geo.perRow - 1) / 2) * PITCH + LABEL_W_OPEN / 2);

  // A trunk pill wider than the room between the peer columns sits past the columns instead of beside them.
  const between = input.peers.length ? px - R1 - 10 : Infinity;
  const pillPast = (p: DiagramPill | null) => !!p && pillLabel("probe", p, 0, 0).box.w / 2 > between;
  const menteePillY = pillPast(input.pills.mentees) ? colHalf + 6 + PILL_H / 2 : null;
  const mentorPillPast = pillPast(input.pills.mentors) ? -(Math.max(colHalf, peerPillTop) + 6 + PILL_H / 2) : null;

  const common = { geo, names, focalKey: focal.key, contentHalf };
  const below = placeSide({
    ...common,
    dir: 1,
    level1: input.mentees,
    band: input.down,
    bandInfo: input.bands.down,
    focalEdge: focalBottom,
    firstBus: Math.max(focalBottom + 42, colHalf + 28, menteePillY !== null ? menteePillY + PILL_H / 2 + 12 : 0),
  });
  const above = placeSide({
    ...common,
    dir: -1,
    level1: input.mentors,
    band: input.up,
    bandInfo: input.bands.up,
    focalEdge: -RF,
    firstBus: Math.min(-RF - 42, -(Math.max(colHalf, peerPillTop) + 28), mentorPillPast !== null ? mentorPillPast - PILL_H / 2 - 12 : 0),
  });

  const focalNode: PlacedNode = {
    key: focal.key,
    slug: focal.slug,
    kind: "focal",
    cx: 0,
    cy: 0,
    r: RF,
    initials: initials(focal.name),
    tint: tintFor(focal.slug),
    nameLines: focalName,
    fullName: focal.name,
    sub: null,
    programLine: null,
    titleLine: focalTitle ? { text: focalTitle, y: focalTitleY } : null,
    label: focal.label,
    you: !!focal.you,
    textAnchor: "middle",
    textX: 0,
    nameY: focalNameY,
    lineHeight: 18,
    subY: focalTitleY,
    nameSize: 14,
    ring: { x: -focalTextW / 2 - 8, y: -RF - 8, w: focalTextW + 16, h: focalBottom + RF + 14 },
  };

  const nodes: PlacedNode[] = [focalNode, ...above.nodes];
  const edges: PlacedEdge[] = [...above.edges];
  const labels: PlacedLabel[] = [...above.labels];

  // The narrow layout's two labels near the top ("Worked alongside" above the left column, "Worked
  // under" on the trunk) share one baseline.
  const mentorPillY = above.bus0 !== null ? (mentorPillPast ?? (-RF + above.bus0) / 2) : null;
  const peerAboveY = -colHalfL - 6 - PILL_H / 2;
  const topLabelY = mentorPillY !== null && geo.peerPillAbove && input.peers.length ? Math.min(mentorPillY, peerAboveY) : null;

  // Peer columns and their spines.
  if (input.peers.length) {
    const place = (list: DiagramMemberInput[], texts: NodeText[], side: "left" | "right") => {
      const s = side === "left" ? -1 : 1;
      list.forEach((m, i) => {
        const cy = (i - (list.length - 1) / 2) * peerPitch;
        nodes.push(peerNode(m, texts[i], s * px, cy, side));
        edges.push(
          edge(`${focal.key}>${m.key}`, [focal.key, m.key], [
            [s * (RF + 2), 0],
            [s * spine, 0],
            [s * spine, cy],
            [s * (px - R1 - 2), cy],
          ]),
        );
      });
    };
    place(left, leftTexts, "left");
    place(right, rightTexts, "right");
    if (peerPill && input.pills.peers) {
      if (geo.peerPillAbove) {
        // Above the left column, its right edge on the spine, clear of the focal coach.
        labels.push(pillLabel("peers", input.pills.peers, -spine - 4, topLabelY ?? peerAboveY, "end"));
      } else {
        labels.push(pillLabel("peers", input.pills.peers, -(focalHalf + spine) / 2, 0));
      }
    }
  }

  nodes.push(...below.nodes);
  edges.push(...below.edges);
  labels.push(...below.labels);

  if (input.pills.mentors && mentorPillY !== null) labels.push(pillLabel("mentors", input.pills.mentors, 0, topLabelY ?? mentorPillY));
  if (input.pills.mentees && below.bus0 !== null) labels.push(pillLabel("mentees", input.pills.mentees, 0, menteePillY ?? (focalBottom + below.bus0) / 2));

  // Canvas: keep the focal coach on the vertical centre line; gutter lanes count.
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
  for (const e of edges) for (const [x] of e.pts) half = Math.max(half, Math.abs(x) + 2);
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
