import { Network } from "lucide-react";
import type { Tint } from "@/lib/format";
import { cn } from "@/lib/cn";
import { possessive } from "./copy";
import { DiagramInteractions } from "./DiagramInteractions";
import type { DiagramLayout, PlacedNode } from "./layout";

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

type TreeDiagramProps = {
  layout: DiagramLayout;
  /** Accessible name of the diagram ("Ian Falconer's coaching tree"). */
  label: string;
  /** Id of the visually hidden keyboard help. */
  helpId: string;
  /** Escape moves focus here. */
  exitTargetId: string;
};

/**
 * The coaching tree as an inline SVG node-link diagram (DESIGN.md §8.8), rendered on the server.
 * Nodes are links to profiles (44px+ targets) with a small badge linking to that coach's own tree;
 * edges are 1.5px --border-strong connectors; pills on the trunks name each group and its count.
 */
export function TreeDiagram({ layout, label, helpId, exitTargetId }: TreeDiagramProps) {
  return (
    <DiagramInteractions exitTargetId={exitTargetId} className="-mx-4 px-4 md:-mx-6 md:px-6">
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
          <g data-edges="" aria-hidden="true">
            {layout.edges.map((e) => (
              <path
                key={e.key}
                data-edge=""
                data-ends={`${e.from} ${e.to}`}
                d={e.d}
                strokeWidth={1.5}
                strokeLinecap="round"
                className={cn(
                  "fill-none stroke-border-strong transition-[stroke,opacity]",
                  "[[data-active]_&]:opacity-40 data-on:opacity-100! data-on:stroke-fg-2!",
                )}
              >
                <title>{e.title}</title>
              </path>
            ))}
          </g>
          <g aria-hidden="true">
            {layout.pills.map((p) => (
              <g key={p.text}>
                <rect x={p.cx - p.w / 2} y={p.cy - 10} width={p.w} height={20} rx={10} className="fill-surface" />
                <text x={p.cx} y={p.cy + 4} textAnchor="middle" fontSize={12} fontWeight={500} className="fill-fg-2">
                  <tspan>{p.text}</tspan>
                  <tspan className="num fill-fg-3">{p.count}</tspan>
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
    <g data-node={n.key} data-kind={n.kind} data-x={n.cx} data-y={n.cy}>
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
        {n.sub && (
          <text x={n.textX} y={n.subY} textAnchor={n.textAnchor} fontSize={12} className="fill-fg-3">
            <tspan>{n.sub.program}</tspan>
            <tspan> · </tspan>
            <tspan
              fontWeight={500}
              className={cn("num fill-fg-2", n.sub.inferred && "underline decoration-fg-3 decoration-dotted decoration-[1.5px] underline-offset-[3px]")}
            >
              {n.sub.range}
            </tspan>
          </text>
        )}
        {focal && n.titleLine && (
          <text x={n.textX} y={n.subY} textAnchor="middle" fontSize={12} className="fill-fg-2">
            {n.titleLine}
          </text>
        )}
      </a>
      {n.badge && (
        <a href={`/in/${n.slug}/tree`} data-tree-link="" className="group/badge outline-none focus-visible:outline-none">
          <title>{`${possessive(n.fullName)} coaching tree`}</title>
          <rect x={n.badge.cx - 12} y={n.badge.cy - 12} width={24} height={24} className="fill-transparent" />
          <circle
            cx={n.badge.cx}
            cy={n.badge.cy}
            r={9.5}
            strokeWidth={1}
            className="fill-surface stroke-control transition-[fill] group-hover/badge:fill-hover group-focus-visible/badge:stroke-focus group-focus-visible/badge:stroke-2"
          />
          <Network x={n.badge.cx - 6} y={n.badge.cy - 6} size={12} strokeWidth={2} aria-hidden="true" focusable="false" className="text-fg-2 group-hover/badge:text-fg-1" />
        </a>
      )}
    </g>
  );
}
