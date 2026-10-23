import { describe, expect, it } from "vitest";
import { PITCH, layoutTree, segments, type DiagramInput, type DiagramLayout, type DiagramMemberInput, type DiagramSecondInput, type LayoutVariant } from "./layout";
import { textWidth, wrapName } from "./metrics";

/* ---------- Fixtures ---------- */

const person = (key: string, name = key, program: string | null = null): DiagramMemberInput => ({
  key,
  slug: key.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
  name,
  program,
  range: { parts: [{ text: "2019", inferred: false }, { text: "–", inferred: false }, { text: "22", inferred: false }], short: null, title: null },
  label: name,
});

/** n first-level people, and blocks of second-level people hanging from the first-level people at `parents` (index → size). */
function tree(opts: { mentors?: number; mentees?: number; peers?: number; up?: [number, number][]; down?: [number, number][] }): DiagramInput {
  const mentors = Array.from({ length: opts.mentors ?? 0 }, (_, i) => person(`mentors:m${i}`, `Mentor Number${i}`));
  const mentees = Array.from({ length: opts.mentees ?? 0 }, (_, i) => person(`mentees:e${i}`, `Mentee Person${i}`));
  const peers = Array.from({ length: opts.peers ?? 0 }, (_, i) => person(`peers:p${i}`, `Peer Person${i}`, i % 2 ? "Trinity (TX)" : null));
  const band = (level1: DiagramMemberInput[], spec: [number, number][] | undefined, dir: string): DiagramSecondInput[] =>
    (spec ?? []).flatMap(([at, size]) =>
      Array.from({ length: size }, (_, j) => ({ ...person(`${dir}:${at}-${j}`, `Second Level${at}x${j}`), parents: [{ key: level1[at].key, program: "George Fox" }] })),
    );
  const up = band(mentors, opts.up, "up");
  const down = band(mentees, opts.down, "down");
  const counts = (list: DiagramSecondInput[]) => Object.fromEntries([...new Set(list.map((s) => s.parents[0].key))].map((k) => [k, list.filter((s) => s.parents[0].key === k).length]));
  return {
    focal: { key: "focal", slug: "focal", name: "Focal Coach", title: "Special Teams Coordinator / Defensive Backs Coach", label: "Focal Coach" },
    mentors,
    peers,
    mentees,
    up,
    down,
    pills: {
      mentors: mentors.length ? { text: "Worked under", count: mentors.length } : null,
      peers: peers.length ? { text: "Worked alongside", count: peers.length } : null,
      mentees: mentees.length ? { text: "Coached under Focal", count: mentees.length } : null,
    },
    bands: { up: up.length ? { label: "Two steps up", counts: counts(up) } : null, down: down.length ? { label: "Two steps down", counts: counts(down) } : null },
  };
}

/* ---------- Invariants ---------- */

type S = ReturnType<typeof segments>[number];
const touches = (a: S, b: S, eps = 0.5) => a.x0 <= b.x1 + eps && b.x0 <= a.x1 + eps && a.y0 <= b.y1 + eps && b.y0 <= a.y1 + eps;

function checkBand(layout: DiagramLayout, input: DiagramInput) {
  const fail: string[] = [];
  const nodes = new Map(layout.nodes.map((n) => [n.key, n]));
  const secondKeys = new Set([...input.up, ...input.down].map((s) => s.key));
  const bandEdges = layout.edges.filter((e) => secondKeys.has(e.ends[1]));
  const trunkEdges = layout.edges.filter((e) => e.ends[0] === "focal");
  const trunkSegs = trunkEdges.flatMap((t) => segments(t.pts).map((s) => ({ s, key: t.key })));

  // Every second-level block sits under its own coach: the coach is within one column of the block.
  const byParent = new Map<string, number[]>();
  for (const e of bandEdges) byParent.set(e.ends[0], [...(byParent.get(e.ends[0]) ?? []), nodes.get(e.ends[1])!.cx]);
  for (const [parent, xs] of byParent) {
    const px = nodes.get(parent)!.cx;
    if (px < Math.min(...xs) - PITCH - 0.5 || px > Math.max(...xs) + PITCH + 0.5) fail.push(`${parent} at ${px} is not over its block ${xs}`);
  }

  // No two coaches' connectors share or cross a segment, vertical or horizontal.
  const segsOf = new Map<string, S[]>();
  for (const e of bandEdges) segsOf.set(e.ends[0], [...(segsOf.get(e.ends[0]) ?? []), ...segments(e.pts)]);
  const parents = [...segsOf.keys()];
  for (let i = 0; i < parents.length; i++)
    for (let j = i + 1; j < parents.length; j++)
      for (const a of segsOf.get(parents[i])!)
        for (const b of segsOf.get(parents[j])!) if (touches(a, b)) fail.push(`${parents[i]} meets ${parents[j]}: ${JSON.stringify(a)} ${JSON.stringify(b)}`);

  // Band connectors never cross the first-level trunk and its bus lines.
  for (const e of bandEdges) for (const a of segments(e.pts)) for (const t of trunkSegs) if (touches(a, t.s)) fail.push(`${e.key} crosses ${t.key}`);

  // Captions: on their own connector, clear of every line, with the coach's full name.
  const allSegs = layout.edges.flatMap((e) => segments(e.pts).map((s) => ({ s, key: e.key })));
  for (const l of layout.labels.filter((x) => x.key.startsWith("via-"))) {
    const box = { x0: l.box.x + 1, x1: l.box.x + l.box.w - 1, y0: l.box.y + 1, y1: l.box.y + l.box.h - 1 };
    for (const { s, key } of allSegs) if (touches(box, s, 0)) fail.push(`${l.key} over ${key}`);
    const parent = l.key.replace(/^via--?1-/, "");
    if (!l.parts.map((p) => p.text).join("").includes(`Via ${nodes.get(parent)!.fullName}`)) fail.push(`${l.key} lacks the full name`);
  }

  // No label (group pill or caption) covers a node.
  for (const l of layout.labels)
    for (const r of layout.nodes) {
      const box = { x0: l.box.x, x1: l.box.x + l.box.w, y0: l.box.y, y1: l.box.y + l.box.h };
      const ring = { x0: r.ring.x + 4, x1: r.ring.x + r.ring.w - 4, y0: r.ring.y + 4, y1: r.ring.y + r.ring.h - 4 };
      if (touches(box, ring, 0)) fail.push(`${l.key} covers ${r.key}`);
    }

  // No two nodes' hover areas overlap.
  const rings = layout.nodes.map((n) => ({ key: n.key, x0: n.ring.x, x1: n.ring.x + n.ring.w, y0: n.ring.y, y1: n.ring.y + n.ring.h }));
  for (let i = 0; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++) if (touches(rings[i], rings[j], -0.5)) fail.push(`${rings[i].key} overlaps ${rings[j].key}`);
  expect(fail.slice(0, 8)).toEqual([]);
}

const VARIANTS: LayoutVariant[] = ["wide", "narrow"];

describe("second-level band", () => {
  it("puts each coach's block under that coach, side by side, in the coaches' order (Tyler Elmore)", () => {
    // Two head coaches, two people above each: the blocks share one row, never stacked on the axis.
    const input = tree({ mentors: 2, peers: 8, up: [[0, 2], [1, 2]] });
    for (const v of VARIANTS) {
      const layout = layoutTree(input, v);
      checkBand(layout, input);
      const n = new Map(layout.nodes.map((x) => [x.key, x]));
      const left = [n.get("up:0-0")!, n.get("up:0-1")!];
      const right = [n.get("up:1-0")!, n.get("up:1-1")!];
      expect(left[0].cy).toBe(right[0].cy);
      expect(Math.max(...left.map((x) => x.cx))).toBeLessThan(Math.min(...right.map((x) => x.cx)));
    }
  });

  it("hangs a coach's block from that coach, with the band label in its caption (Brant McAdams)", () => {
    // 21 people coached under Brant; Spencer Crace (index 17) has 17 people of their own.
    const input = tree({ mentors: 2, peers: 6, mentees: 21, down: [[17, 17]] });
    for (const v of VARIANTS) {
      const layout = layoutTree(input, v);
      checkBand(layout, input);
      const caption = layout.labels.find((l) => l.key.startsWith("via-1-"))!;
      expect(caption.parts.map((p) => p.text).join("")).toBe("Two steps down · 17 · Via Mentee Person17 · George Fox");
      // No free-floating band pill.
      expect(layout.labels.some((l) => l.key.startsWith("band"))).toBe(false);
    }
  });

  it("gives coaches with blocks their own lanes, never shared (Kevin Kelly, Bob Rankl)", () => {
    const kevin = tree({ mentees: 14, down: [[3, 6], [4, 13], [5, 12]] });
    const bob = tree({ mentees: 20, peers: 4, down: [[14, 12], [16, 13]] });
    for (const v of VARIANTS) {
      checkBand(layoutTree(kevin, v), kevin);
      checkBand(layoutTree(bob, v), bob);
    }
  });

  it("keeps the coach's own people in the profile order when two steps are shown", () => {
    const plain = tree({ mentees: 21 });
    const deep = tree({ mentees: 21, down: [[17, 17]] });
    for (const v of VARIANTS) {
      const pos = (l: DiagramLayout) => l.nodes.filter((n) => n.key.startsWith("mentees:")).map((n) => `${n.key}@${n.cx},${n.cy}`);
      expect(pos(layoutTree(deep, v))).toEqual(pos(layoutTree(plain, v)));
    }
  });

  it("holds for any mix of blocks (seeded fuzz)", () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let t = 0; t < 300; t++) {
      const mentees = 1 + rand(24);
      const mentors = 1 + rand(4);
      const pick = (n: number, max: number) => [...new Set(Array.from({ length: 1 + rand(max) }, () => rand(n)))];
      const down = pick(mentees, 4).map((at): [number, number] => [at, 1 + rand(14)]);
      const up = rand(2) ? pick(mentors, 3).map((at): [number, number] => [at, 1 + rand(6)]) : [];
      const input = tree({ mentees, mentors, peers: rand(9), up, down });
      if (rand(2) && input.pills.mentees) input.pills.mentees.extra = "Ellsworth Community College";
      if (rand(2) && input.pills.mentors) input.pills.mentors.extra = "University of Wisconsin–Stevens Point";
      input.peers = input.peers.map((p, i) => (i % 3 === 0 ? { ...p, name: "Lucas Kleinschrodt-Hennessey" } : p));
      for (const v of VARIANTS) checkBand(layoutTree(input, v), input);
    }
  }, 60000);
});

describe("labels", () => {
  it("never cuts a name: long names wrap to two lines", () => {
    expect(wrapName("Greysen Dagsaan-Phillips", 132, 12)).toEqual(["Greysen", "Dagsaan-Phillips"]);
    expect(wrapName("Christian Legagneur", 100, 12)).toEqual(["Christian", "Legagneur"]);
    expect(wrapName("Ian Falconer", 132, 12)).toEqual(["Ian Falconer"]);
  });

  it("measures text close to the browser (Inter, Chromium)", () => {
    // Measured with getComputedTextLength() in the running app.
    expect(textWidth("Greysen Dagsaan-Phillips", 12, 600)).toBeCloseTo(149.6, -1);
    expect(textWidth("Via Spencer Crace · George Fox", 12)).toBeCloseTo(181.5, -1);
    // "Puget Sound · 2010–12" fits a label in a row no lane runs through (140px).
    expect(textWidth("Puget Sound · ", 12) + textWidth("2010–12", 12, 500, true)).toBeLessThan(140);
  });

  it("gives every node in a row a program line when one needs it", () => {
    const input = tree({ mentors: 2 });
    input.mentors[0] = { ...input.mentors[0], program: "Trinity (TX)" };
    input.mentors[1] = { ...input.mentors[1], program: "University of Wisconsin–Stevens Point" };
    const layout = layoutTree(input, "wide");
    const [a, b] = ["mentors:m0", "mentors:m1"].map((k) => layout.nodes.find((n) => n.key === k)!);
    expect(a.programLine?.text).toBe("Trinity (TX)");
    expect(b.programLine).not.toBeNull();
    expect(a.subY).toBe(b.subY);
  });

  it("spaces a peer column further apart when its labels take three lines", () => {
    const input = tree({ peers: 4 });
    input.peers = input.peers.map((p) => ({ ...p, program: "Pacific Lutheran University Lutes" }));
    const layout = layoutTree(input, "narrow");
    const left = layout.nodes.filter((n) => n.kind === "peer-left").sort((a, b) => a.cy - b.cy);
    expect(left[1].cy - left[0].cy).toBeGreaterThanOrEqual(68);
  });

  it("abbreviates the focal title before cutting it", () => {
    const layout = layoutTree(tree({ mentees: 1 }), "wide");
    expect(layout.nodes[0].titleLine?.text).toBe("ST Coord. / DBs Coach");
  });
});
