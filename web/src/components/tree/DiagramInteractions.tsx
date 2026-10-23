"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Dir = "up" | "down" | "left" | "right";
const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

type NodeInfo = { el: SVGGElement; key: string; kind: string; x: number; y: number };

function readNodes(root: HTMLElement): NodeInfo[] {
  return [...root.querySelectorAll<SVGGElement>("[data-node]")].map((el) => ({
    el,
    key: el.dataset.node!,
    kind: el.dataset.kind!,
    x: Number(el.dataset.x),
    y: Number(el.dataset.y),
  }));
}

/** Arrow-key neighbour: rows above and below, along a row, and in and out of the peer columns. */
function neighbour(nodes: NodeInfo[], from: NodeInfo, dir: Dir): NodeInfo | null {
  const isPeer = (n: NodeInfo) => n.kind === "peer-left" || n.kind === "peer-right";
  const nearest = (list: NodeInfo[], axis: "x" | "y", value: number) =>
    list.reduce<NodeInfo | null>((best, n) => (!best || Math.abs(n[axis] - value) < Math.abs(best[axis] - value) ? n : best), null);

  if (isPeer(from)) {
    const column = nodes.filter((n) => n.kind === from.kind).sort((a, b) => a.y - b.y);
    const i = column.indexOf(from);
    if (dir === "up") return column[i - 1] ?? null;
    if (dir === "down") return column[i + 1] ?? null;
    const towardCentre = from.kind === "peer-left" ? "right" : "left";
    return dir === towardCentre ? (nodes.find((n) => n.kind === "focal") ?? null) : null;
  }

  const centre = nodes.filter((n) => !isPeer(n));
  if (dir === "up" || dir === "down") {
    const rows = [...new Set(centre.map((n) => n.y))].sort((a, b) => a - b);
    const target = rows[rows.indexOf(from.y) + (dir === "up" ? -1 : 1)];
    if (target === undefined) return null;
    return nearest(
      centre.filter((n) => n.y === target),
      "x",
      from.x,
    );
  }
  const row = centre.filter((n) => n.y === from.y).sort((a, b) => a.x - b.x);
  const next = row[row.indexOf(from) + (dir === "left" ? -1 : 1)];
  if (next) return next;
  if (from.kind === "focal") {
    return nearest(
      nodes.filter((n) => n.kind === (dir === "left" ? "peer-left" : "peer-right")),
      "y",
      from.y,
    );
  }
  return null;
}

type DiagramInteractionsProps = {
  children: ReactNode;
  /** Element that Escape returns focus to. */
  exitTargetId: string;
  className?: string;
};

/**
 * Behaviour for the server-rendered tree SVG (DESIGN.md §8.8): Tab enters at the focal coach (one
 * tab stop for the whole diagram, plus the focused node's own tree link), arrow keys move between
 * rows and along them, Enter opens, Escape returns to the page. Hovering or focusing a node turns its
 * edges --fg-2 and fades the rest to 40%. Links navigate client-side. Wide diagrams scroll
 * horizontally inside the card, starting centred on the focal coach.
 */
export function DiagramInteractions({ children, exitTargetId, className }: DiagramInteractionsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef<string | null>(null);
  const router = useRouter();

  function setTabStop(key: string | null) {
    const root = ref.current;
    if (!root) return;
    const nodes = readNodes(root);
    const stop = key ?? nodes[0]?.key;
    for (const n of nodes) {
      for (const a of n.el.querySelectorAll("a")) a.setAttribute("tabindex", n.key === stop ? "0" : "-1");
    }
  }

  function activate(key: string | null) {
    const root = ref.current;
    if (!root) return;
    if (key) root.setAttribute("data-active", key);
    else root.removeAttribute("data-active");
    const layer = root.querySelector("[data-edges]");
    for (const p of root.querySelectorAll<SVGPathElement>("[data-edge]")) {
      const on = !!key && (p.dataset.ends ?? "").split(" ").includes(key);
      p.toggleAttribute("data-on", on);
      // Highlighted edges paint last, over the shared trunks.
      if (on && layer) layer.appendChild(p);
    }
  }

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    setTabStop(null);
    if (root.scrollWidth > root.clientWidth) root.scrollLeft = (root.scrollWidth - root.clientWidth) / 2;
    // When the diagram is wider than the card, fade the edge it continues past (a scroll cue).
    const fade = () => {
      const max = root.scrollWidth - root.clientWidth;
      const left = max > 1 && root.scrollLeft > 1;
      const right = max > 1 && root.scrollLeft < max - 1;
      const mask = left || right ? `linear-gradient(to right, ${left ? "transparent" : "black"}, black 32px, black calc(100% - 32px), ${right ? "transparent" : "black"})` : "";
      root.style.maskImage = mask;
      root.style.webkitMaskImage = mask;
    };
    fade();
    root.addEventListener("scroll", fade, { passive: true });
    window.addEventListener("resize", fade);
    return () => {
      root.removeEventListener("scroll", fade);
      window.removeEventListener("resize", fade);
    };
  }, []);

  function nodeOf(target: EventTarget | null): SVGGElement | null {
    return target instanceof Element ? target.closest<SVGGElement>("[data-node]") : null;
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const root = ref.current;
    const from = nodeOf(e.target);
    if (!root || !from) return;
    if (e.key === "Escape") {
      e.preventDefault();
      document.getElementById(exitTargetId)?.focus();
      return;
    }
    const dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    const nodes = readNodes(root);
    const current = nodes.find((n) => n.el === from);
    const next = current && neighbour(nodes, current, dir);
    if (!next) return;
    setTabStop(next.key);
    next.el.querySelector<SVGAElement>("[data-node-link]")?.focus();
  }

  function onClick(e: MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest("a") : null;
    const href = a?.getAttribute("href");
    if (!a || !href?.startsWith("/")) return;
    e.preventDefault();
    router.push(href);
  }

  return (
    <div
      ref={ref}
      className={cn("overflow-x-auto overscroll-x-contain", className)}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onPointerOver={(e) => activate(nodeOf(e.target)?.dataset.node ?? focused.current)}
      onPointerLeave={() => activate(focused.current)}
      onFocus={(e) => {
        const key = nodeOf(e.target)?.dataset.node ?? null;
        focused.current = key;
        if (key) setTabStop(key);
        activate(key);
      }}
      onBlur={(e) => {
        if (ref.current?.contains(e.relatedTarget as Node | null)) return;
        // Leaving the diagram: the next Tab into it starts at the focal coach again.
        focused.current = null;
        setTabStop(null);
        activate(null);
      }}
    >
      {children}
    </div>
  );
}
