import { initials, tintFor, type Tint } from "@/lib/format";

/*
 * Layered layout for the coaching tree diagram (DESIGN.md §8.8). Pure geometry, no physics:
 *
 *   two steps up            (depth 2, small nodes)
 *   worked under            (rows of 6)
 *   alongside · FOCAL · alongside
 *   coached under {first}   (rows of 6)
 *   two steps down          (depth 2, small nodes)
 *
 * Edges are org-chart connectors with rounded corners: a trunk from the focal coach to a bus line
 * in the gap above (or below) each row, then a short drop to the node. Rows that a trunk or a
 * second-level connector passes through keep their nodes on half-pitch offsets, so the vertical
 * lanes at whole-pitch offsets always run through gaps between labels, never through a node.
 * Peers stack in a column on each side of the focal coach, joined by a vertical spine; the focal
 * lane grows tall enough that the columns never meet the rows above or below.
 */

export type DiagramRel = {
  /** Program short name where the two coaches overlapped. */
  program: string;
  /** Compact range ("2020–", "2010–12"). */
  range: string;
  inferred: boolean;
};

export type DiagramMemberInput = {
  /** Unique node key ("mentees:p-jim-craft"); a person can sit in two groups. */
  key: string;
  slug: string;
  name: string;
  rel: DiagramRel;
  /** Accessible name of the profile link (name, title and the relationship in words). */
  label: string;
  /** Tooltip of the edge to the focal coach: the program and full seasons. */
  edgeTitle: string;
  /** The signed-in viewer: an Iris ring around the avatar (the viewer's own row in a chart), named in the legend. */
  you?: boolean;
};

export type DiagramSecondInput = Omit<DiagramMemberInput, "edgeTitle"> & {
  /** First-level node keys this person connects through, with each edge's tooltip. */
  parents: { key: string; edgeTitle: string }[];
};

export type DiagramPill = { text: string; count: number };

export type DiagramInput = {
  focal: { key: string; slug: string; name: string; title: string | null; label: string; you?: boolean };
  mentors: DiagramMemberInput[];
  peers: DiagramMemberInput[];
  mentees: DiagramMemberInput[];
  up: DiagramSecondInput[];
  down: DiagramSecondInput[];
  pills: { mentors: DiagramPill | null; peers: DiagramPill | null; mentees: DiagramPill | null };
};

export type NodeKind = "focal" | "member" | "second" | "peer-left" | "peer-right";

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
  /** Second line: program (truncated) · compact range (never truncated). */
  sub: { program: string; range: string; inferred: boolean } | null;
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
  /** The node's own "tree" link, a small badge on the avatar (none on the focal coach). */
  badge: { cx: number; cy: number } | null;
};

export type PlacedEdge = { key: string; from: string; to: string; d: string; title: string; second: boolean };
export type PlacedPill = { cx: number; cy: number; w: number; text: string; count: string };

export type DiagramLayout = {
  width: number;
  height: number;
  /** Translate raw coordinates (focal avatar centre at 0,0) into the SVG viewport. */
  tx: number;
  ty: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  pills: PlacedPill[];
};

/* ---------- Geometry ---------- */

const PITCH = 148; // slot width of a node in a row
const PER_ROW = 6; // rows wrap at 6 (DESIGN.md §8.8)
const LABEL_W = 132; // max text width under a node (PITCH − 16: 8px clearance each side of a lane)
const R1 = 20; // first level: avatar 40
const R2 = 16; // second level: avatar 32
const RF = 32; // focal: avatar 64
const NODE_BELOW = 40; // avatar bottom → node bottom (6px gap + two 16px lines + 2)
const FOCAL_BOTTOM = RF + 48; // focal avatar centre → bottom of its title line
const FOCAL_TEXT_W = 240;
const ROW_GAP = 44;
const BAND_GAP = 56;
const BUS_INSET = 22; // bus line distance from the row it feeds
const PEER_PITCH = 52;
const PEER_TEXT_W = 148;
const STUB = 16; // spine → peer avatar
const PILL_PAD = 14;
const MARGIN = 8;
/** Tree badge centre, right and down of the avatar centre: on the rim, clear of the initials. */
const badgeOffset = (r: number) => r * 0.71 + 3;

/* ---------- Text measurement (Inter, approximate advance widths in em) ---------- */

const NARROW = new Set("iljI.,:;'’|!·");
const SEMI_NARROW = new Set("ftr()[]-/ ");
const WIDE = new Set("mwMW");
const UPPER = /[A-Z]/;

function charEm(ch: string): number {
  if (NARROW.has(ch)) return 0.26;
  if (SEMI_NARROW.has(ch)) return ch === " " ? 0.27 : 0.36;
  if (WIDE.has(ch)) return ch === ch.toUpperCase() ? 0.92 : 0.84;
  if (/[0-9]/.test(ch)) return 0.62;
  if (ch === "–") return 0.56;
  if (ch === "…") return 0.8;
  if (ch === "&") return 0.66;
  if (UPPER.test(ch)) return 0.68;
  return 0.56;
}

export function textWidth(text: string, size: number, weight: 400 | 500 | 600 = 400): number {
  let em = 0;
  for (const ch of text) em += charEm(ch);
  return em * size * (weight === 600 ? 1.05 : weight === 500 ? 1.025 : 1);
}

export function truncate(text: string, maxW: number, size: number, weight: 400 | 500 | 600 = 400): string {
  if (textWidth(text, size, weight) <= maxW) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t.trimEnd()}…`, size, weight) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

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

/* ---------- Rows ---------- */

type Row = { cy: number; top: number; bottom: number; bus: number; near: number; far: number; xs: number[] };

/** Horizontal offsets (in pitches) for n nodes; lane-safe rows keep whole-pitch offsets free. */
function rowOffsets(n: number, laneSafe: boolean): number[] {
  if (laneSafe && n % 2 === 1) {
    const start = Math.floor((PER_ROW - n) / 2);
    return Array.from({ length: n }, (_, i) => start + i - (PER_ROW - 1) / 2);
  }
  return Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
}

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

function verticalNode(m: DiagramMemberInput, cx: number, cy: number, r: number, kind: "member" | "second"): PlacedNode {
  const name = truncate(m.name, LABEL_W, 12, 600);
  const rangeW = textWidth(` · ${m.rel.range}`, 12);
  const program = truncate(m.rel.program, Math.max(24, LABEL_W - rangeW), 12);
  const textW = Math.max(textWidth(name, 12, 600), textWidth(program, 12) + rangeW, 2 * r);
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
    sub: { program, range: m.rel.range, inferred: m.rel.inferred },
    titleLine: null,
    label: m.label,
    you: !!m.you,
    textAnchor: "middle",
    textX: cx,
    nameY: cy + r + 18,
    subY: cy + r + 34,
    nameSize: 12,
    ring: { x: cx - textW / 2 - 6, y: cy - r - 6, w: textW + 12, h: 2 * r + NODE_BELOW + 8 },
    badge: { cx: cx + badgeOffset(r), cy: cy + badgeOffset(r) },
  };
}

function peerNode(m: DiagramMemberInput, cx: number, cy: number, side: "left" | "right"): PlacedNode {
  const name = truncate(m.name, PEER_TEXT_W, 12, 600);
  const rangeW = textWidth(` · ${m.rel.range}`, 12);
  const program = truncate(m.rel.program, Math.max(24, PEER_TEXT_W - rangeW), 12);
  const textW = Math.max(textWidth(name, 12, 600), textWidth(program, 12) + rangeW);
  const left = side === "left";
  const textX = left ? cx - R1 - 8 : cx + R1 + 8;
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
    sub: { program, range: m.rel.range, inferred: m.rel.inferred },
    titleLine: null,
    label: m.label,
    you: !!m.you,
    textAnchor: left ? "end" : "start",
    textX,
    nameY: cy - 3,
    subY: cy + 13,
    nameSize: 12,
    ring: left
      ? { x: textX - textW - 6, y: cy - R1 - 6, w: textW + 8 + 2 * R1 + 12, h: 2 * R1 + 12 }
      : { x: cx - R1 - 6, y: cy - R1 - 6, w: 2 * R1 + 8 + textW + 12, h: 2 * R1 + 12 },
    // The badge sits on the avatar's outer lower corner, away from the text.
    badge: { cx: left ? cx + badgeOffset(R1) : cx - badgeOffset(R1), cy: cy + badgeOffset(R1) },
  };
}

function pill(p: DiagramPill, cx: number, cy: number): PlacedPill {
  const count = ` · ${p.count}`;
  const w = textWidth(p.text, 12, 500) + textWidth(count, 12, 500) + 2 * 8;
  return { cx, cy, w, text: p.text, count };
}

/* ---------- Layout ---------- */

type Band = {
  rows: Row[];
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  bus0: number | null;
};

/**
 * One side of the focal coach (dir 1 = below, −1 = above): the first-level rows, then the
 * second-level band, with their connectors.
 */
function placeSide(dir: 1 | -1, level1: DiagramMemberInput[], band: DiagramSecondInput[], focalKey: string, colHalf: number, names: Map<string, string>): Band {
  const out: Band = { rows: [], nodes: [], edges: [], bus0: null };
  if (!level1.length) return out;

  // Parents of second-level people go last, so they sit in the outermost row next to the band.
  const parentKeys = new Set(band.flatMap((b) => b.parents.map((p) => p.key)));
  const ordered = band.length ? [...level1.filter((m) => !parentKeys.has(m.key)), ...level1.filter((m) => parentKeys.has(m.key))] : level1;
  const chunks = chunk(ordered, PER_ROW);
  const parentNotOutermost = chunks.slice(0, -1).some((c) => c.some((m) => parentKeys.has(m.key)));

  const focalEdge = dir > 0 ? FOCAL_BOTTOM : -RF;
  const rows: Row[] = [];
  let cursor = 0;
  chunks.forEach((c, i) => {
    const laneSafe = i < chunks.length - 1 || parentNotOutermost;
    const xs = rowOffsets(c.length, laneSafe).map((o) => o * PITCH);
    let row: Row;
    if (dir > 0) {
      const bus = i === 0 ? Math.max(FOCAL_BOTTOM + 42, colHalf + 28) : cursor + ROW_GAP - BUS_INSET;
      const top = bus + BUS_INSET;
      const cy = top + R1;
      const bottom = cy + R1 + NODE_BELOW;
      row = { cy, top, bottom, bus, near: top, far: bottom, xs };
      cursor = bottom;
    } else {
      const bus = i === 0 ? Math.min(-RF - 42, -(colHalf + 28)) : cursor - ROW_GAP + BUS_INSET;
      const bottom = bus - BUS_INSET;
      const cy = bottom - NODE_BELOW - R1;
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
      out.nodes.push(verticalNode(m, x, rows[i].cy, R1, "member"));
      out.edges.push({
        key: `${focalKey}>${m.key}`,
        from: focalKey,
        to: m.key,
        d: roundedPath([
          [0, focalEdge],
          [0, rows[i].bus],
          [x, rows[i].bus],
          [x, rows[i].near],
        ]),
        title: m.edgeTitle,
        second: false,
      });
    }),
  );

  // Second level: one block of rows per first-level person (their first parent, left to right), so
  // each row's bus line belongs to one parent. Every row but the outermost stays lane-safe, because
  // later blocks' connectors run down the lanes through it.
  if (band.length) {
    const xOf = (key: string) => where.get(key)?.x ?? 0;
    const primary = (b: DiagramSecondInput) => [...b.parents].sort((p, q) => xOf(p.key) - xOf(q.key))[0]?.key ?? "";
    const groups = new Map<string, DiagramSecondInput[]>();
    for (const b of band) groups.set(primary(b), [...(groups.get(primary(b)) ?? []), b]);
    const bandChunks = [...groups.entries()].sort(([a], [b]) => xOf(a) - xOf(b)).flatMap(([, list]) => chunk(list, PER_ROW));
    const bandRows: Row[] = [];
    bandChunks.forEach((c, i) => {
      const xs = rowOffsets(c.length, i < bandChunks.length - 1).map((o) => o * PITCH);
      const gap = i === 0 ? BAND_GAP : ROW_GAP;
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
    bandChunks.forEach((c, k) =>
      c.forEach((b, j) => {
        const xc = bandRows[k].xs[j];
        out.nodes.push(verticalNode({ ...b, edgeTitle: "" }, xc, bandRows[k].cy, R2, "second"));
        for (const p of b.parents) {
          const at = where.get(p.key);
          if (!at) continue;
          const farP = rows[at.row].far;
          let pts: Pt[];
          if (at.row === lastL && k === 0) {
            pts = [
              [at.x, farP],
              [at.x, bandRows[0].bus],
              [xc, bandRows[0].bus],
              [xc, bandRows[0].near],
            ];
          } else {
            const nextBus = at.row < lastL ? rows[at.row + 1].bus : bandRows[0].bus;
            const lane = laneFor(at.x, xc);
            pts = [
              [at.x, farP],
              [at.x, nextBus],
              [lane, nextBus],
              [lane, bandRows[k].bus],
              [xc, bandRows[k].bus],
              [xc, bandRows[k].near],
            ];
          }
          out.edges.push({ key: `${p.key}>${b.key}`, from: p.key, to: b.key, d: roundedPath(pts), title: p.edgeTitle, second: true });
        }
      }),
    );
    out.rows = [...rows, ...bandRows];
  } else {
    out.rows = rows;
  }

  for (const n of out.nodes) names.set(n.key, n.fullName);
  return out;
}

export function layoutTree(input: DiagramInput): DiagramLayout {
  const { focal } = input;
  const names = new Map<string, string>([[focal.key, focal.name]]);

  // Peers: first half on the left, the rest on the right, each column centred on the focal coach.
  const nLeft = Math.ceil(input.peers.length / 2);
  const left = input.peers.slice(0, nLeft);
  const right = input.peers.slice(nLeft);
  const colHalfOf = (n: number) => (n ? ((n - 1) / 2) * PEER_PITCH + R1 + 6 : 0);
  const colHalf = Math.max(colHalfOf(left.length), colHalfOf(right.length));

  const below = placeSide(1, input.mentees, input.down, focal.key, colHalf, names);
  const above = placeSide(-1, input.mentors, input.up, focal.key, colHalf, names);

  // Focal coach.
  const focalName = truncate(focal.name, FOCAL_TEXT_W, 14, 600);
  const focalTitle = focal.title ? truncate(focal.title, FOCAL_TEXT_W, 12) : null;
  const focalTextW = Math.max(textWidth(focalName, 14, 600), focalTitle ? textWidth(focalTitle, 12) : 0, 2 * RF);
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
    titleLine: focalTitle,
    label: focal.label,
    you: !!focal.you,
    textAnchor: "middle",
    textX: 0,
    nameY: RF + 24,
    subY: RF + 42,
    nameSize: 14,
    ring: { x: -focalTextW / 2 - 8, y: -RF - 8, w: focalTextW + 16, h: FOCAL_BOTTOM + RF + 14 },
    badge: null,
  };

  const nodes: PlacedNode[] = [focalNode, ...above.nodes];
  const edges: PlacedEdge[] = [...above.edges];
  const pills: PlacedPill[] = [];

  // Peer columns and their spines.
  if (input.peers.length) {
    const peerPill = input.pills.peers ? pill(input.pills.peers, 0, 0) : null;
    const spine = Math.max(RF + 2 + PILL_PAD + (peerPill?.w ?? 0) + PILL_PAD, focalTextW / 2 + 16, 150);
    const px = spine + STUB + R1;
    const place = (list: DiagramMemberInput[], side: "left" | "right") => {
      const s = side === "left" ? -1 : 1;
      list.forEach((m, i) => {
        const cy = (i - (list.length - 1) / 2) * PEER_PITCH;
        const node = peerNode(m, s * px, cy, side);
        nodes.push(node);
        names.set(node.key, node.fullName);
        edges.push({
          key: `${focal.key}>${m.key}`,
          from: focal.key,
          to: m.key,
          d: roundedPath([
            [s * (RF + 2), 0],
            [s * spine, 0],
            [s * spine, cy],
            [s * (px - R1 - 2), cy],
          ]),
          title: m.edgeTitle,
          second: false,
        });
      });
    };
    place(left, "left");
    place(right, "right");
    if (peerPill) pills.push({ ...peerPill, cx: -(RF + 2 + spine) / 2 });
  }

  nodes.push(...below.nodes);
  edges.push(...below.edges);

  if (input.pills.mentors && above.bus0 !== null) pills.push(pill(input.pills.mentors, 0, (-RF + above.bus0) / 2));
  if (input.pills.mentees && below.bus0 !== null) pills.push(pill(input.pills.mentees, 0, (FOCAL_BOTTOM + below.bus0) / 2));

  // Canvas: keep the focal coach on the vertical centre line.
  let minY = Infinity;
  let maxY = -Infinity;
  let half = 0;
  for (const n of nodes) {
    minY = Math.min(minY, n.ring.y);
    maxY = Math.max(maxY, n.ring.y + n.ring.h);
    half = Math.max(half, Math.abs(n.ring.x), Math.abs(n.ring.x + n.ring.w));
    if (n.badge) half = Math.max(half, Math.abs(n.badge.cx) + 12);
  }
  for (const p of pills) half = Math.max(half, Math.abs(p.cx) + p.w / 2);
  half += MARGIN;
  return {
    width: Math.ceil(2 * half),
    height: Math.ceil(maxY - minY + 2 * MARGIN),
    tx: half,
    ty: -minY + MARGIN,
    nodes,
    edges: edges.map((e) => ({ ...e, title: e.title || `${names.get(e.from)} and ${names.get(e.to)}` })),
    pills,
  };
}
