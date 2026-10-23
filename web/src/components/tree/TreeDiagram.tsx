import type { Tint } from "@/lib/format";
import { DiagramInteractions } from "./DiagramInteractions";
import type { DiagramLayout, PlacedLabel, PlacedNode } from "./layout";

const TINT_BG: Record<Tint, string> = {
  1: "fill-av1-bg",
  2: "fill-av2-bg",
  3: "fill-av3-bg",
  4: "fill-av4-bg",
  5: "fill-av5-bg",
  6: "fill-av6-bg",
};
const TINT_FG: Record<Tint, string> = {
  1: "fill-av1-fg",
  2: "fill-av2-fg",
  3: "fill-av3-fg",
  4: "fill-av4-fg",
  5: "fill-av5-fg",
  6: "fill-av6-fg",
};
const INITIALS_SIZE: Record<number, number> = { 32: 22, 20: 14, 16: 12 };
const TONE: Record<PlacedLabel["parts"][number]["tone"], { className: string; weight: number }> = {
  strong: { className: "fill-fg-2", weight: 500 },
  count: { className: "num fill-fg-3", weight: 500 },
  muted: { className: "fill-fg-3", weight: 400 },
};

type TreeDiagramProps = {
  layout: DiagramLayout;
  /** Accessible name of the diagram ("Ian Falconer's coaching tree"). */
  label: string;
  /** Id of the visually hidden keyboard help. */
  helpId: string;
  /** Escape moves focus here (a visible element: the diagram card). */
  exitTargetId: string;
  className?: string;
};

/**
 * The coaching tree as an inline SVG node-link diagram (DESIGN.md §8.8), rendered on the server.
 * Nodes are links to profiles (44px+ targets). Connectors are drawn as one 1.5px --border-strong path,
 * so trunks shared by many people paint once; each node has a merged --fg-2 highlight path that shows
 * on hover or focus while the rest fade to 40%. Pills on the trunks name each group and its count;
 * "Via …" captions name the first-level coach each second-level block hangs from.
 */
export function TreeDiagram({ layout, label, helpId, exitTargetId, className }: TreeDiagramProps) {
  const base = layout.edges.map((e) => e.d).join(" ");
  const highlights = layout.nodes
    .map((n) => ({ key: n.key, d: layout.edges.filter((e) => e.ends.includes(n.key)).map((e) => e.d).join(" ") }))
    .filter((h) => h.d);
  return (
    <DiagramInteractions exitTargetId={exitTargetId} className={className}>
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label={label}
        aria-describedby={helpId}
        className="mx-auto block max-w-none select-none"
      >
        <g transform={`translate(${layout.tx} ${layout.ty})`}>
          <g aria-hidden="true">
            <path d={base} strokeWidth={1.5} strokeLinecap="round" className="fill-none stroke-border-strong transition-opacity [[data-active]_&]:opacity-40" />
            {highlights.map((h) => (
              <path key={h.key} data-hl={h.key} d={h.d} strokeWidth={1.5} strokeLinecap="round" className="invisible fill-none stroke-fg-2 data-on:visible" />
            ))}
          </g>
          <g aria-hidden="true">
            {layout.labels.map((l) => (
              <g key={l.key}>
                <rect x={l.box.x} y={l.box.y} width={l.box.w} height={l.box.h} rx={l.box.h / 2} className="fill-surface" />
                <text x={l.x} y={l.y + 4} textAnchor={l.anchor} fontSize={12}>
                  {l.parts.map((p, i) => (
                    <tspan key={i} fontWeight={TONE[p.tone].weight} className={TONE[p.tone].className}>
                      {p.text}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}
          </g>
          <g>
            {layout.nodes.map((n) => (
              <DiagramNode key={n.key} node={n} />
            ))}
          </g>
        </g>
      </svg>
    </DiagramInteractions>
  );
}

function DiagramNode({ node: n }: { node: PlacedNode }) {
  const focal = n.kind === "focal";
  return (
    <g data-node={n.key} data-kind={n.kind} data-name={n.fullName} data-x={n.cx} data-y={n.cy}>
      {/* The <title> is both the link's accessible name and its hover tooltip (full name, role, relationship). */}
      <a href={`/in/${n.slug}`} data-node-link="" className="group/node outline-none focus-visible:outline-none">
        <title>{n.label}</title>
        <rect
          x={n.ring.x}
          y={n.ring.y}
          width={n.ring.w}
          height={n.ring.h}
          rx={8}
          strokeWidth={2}
          className="fill-transparent stroke-transparent transition-[fill] group-hover/node:fill-hover group-focus-visible/node:stroke-focus"
        />
        <circle cx={n.cx} cy={n.cy} r={n.r} className={TINT_BG[n.tint]} />
        {/* The viewer's own node: an extra Iris ring (a shape, not only a color), named "You" in the legend. */}
        {n.you && <circle cx={n.cx} cy={n.cy} r={n.r + 3} strokeWidth={2} className="fill-none stroke-accent" />}
        <text
          x={n.cx}
          y={n.cy}
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={INITIALS_SIZE[n.r] ?? 14}
          fontWeight={600}
          aria-hidden="true"
          className={TINT_FG[n.tint]}
        >
          {n.initials}
        </text>
        <text
          x={n.textX}
          y={n.nameY}
          textAnchor={n.textAnchor}
          fontSize={n.nameSize}
          fontWeight={600}
          className="fill-fg-1 underline-offset-2 group-hover/node:underline"
        >
          {n.name}
        </text>
        {n.programLine && (
          <text x={n.textX} y={n.programLine.y} textAnchor={n.textAnchor} fontSize={12} className="fill-fg-3" aria-hidden="true">
            {n.programLine.text}
          </text>
        )}
        {n.sub && (
          <>
            <text x={n.textX} y={n.subY} textAnchor={n.textAnchor} fontSize={12} className="fill-fg-3" aria-hidden="true">
              {n.sub.program && <tspan>{`${n.sub.program} · `}</tspan>}
              <tspan data-range="" fontWeight={500} className="num fill-fg-2">
                {n.sub.parts.map((p, i) => (
                  <tspan key={i} data-part={i}>
                    {p.text}
                  </tspan>
                ))}
              </tspan>
            </text>
            {/* Inferred years: a dotted 1.5px --fg-3 mark 3px under the baseline (SVG text ignores text-decoration styles). */}
            {n.sub.marks.map((m) => (
              <line
                key={m.part}
                data-mark={m.part}
                x1={m.x + 0.75}
                x2={m.x + m.w - 0.75}
                y1={n.subY + 4}
                y2={n.subY + 4}
                strokeWidth={1.5}
                strokeDasharray="0 3"
                strokeLinecap="round"
                className="stroke-fg-3"
              />
            ))}
            {n.sub.hit && n.sub.title && (
              <rect data-hit="" x={n.sub.hit.x} y={n.sub.hit.y} width={n.sub.hit.w} height={n.sub.hit.h} className="cursor-help fill-transparent">
                <title>{n.sub.title}</title>
              </rect>
            )}
          </>
        )}
        {focal && n.titleLine && (
          <text x={n.textX} y={n.subY} textAnchor="middle" fontSize={12} className="fill-fg-2">
            {n.titleLine}
          </text>
        )}
      </a>
    </g>
  );
}
