"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Flag, Network } from "lucide-react";
import { DemoLabel } from "@/components/data/Badges";
import { ContextLine } from "@/components/data/ContextLine";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import type { SheetInfo } from "./diagramInput";
import { RangeText } from "./TreeRange";

type Dir = "up" | "down" | "left" | "right";
const KEYS: Record<string, Dir> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

/** Zoom steps for the buttons; a pinch can land anywhere between the ends. */
const ZOOMS = [0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 1.75, 2];
const ZOOM_MIN = ZOOMS[0];
const ZOOM_MAX = ZOOMS[ZOOMS.length - 1];

type NodeInfo = { el: SVGGElement; key: string; person: string; kind: string; x: number; y: number };

/** The nodes of the diagram that is showing (the other breakpoint's layout is display: none). */
function readNodes(root: HTMLElement): NodeInfo[] {
  return [...root.querySelectorAll<SVGGElement>("[data-node]")]
    .filter((el) => (el.ownerSVGElement?.getClientRects().length ?? 0) > 0)
    .map((el) => ({ el, key: el.dataset.node!, person: el.dataset.person ?? "", kind: el.dataset.kind!, x: Number(el.dataset.x), y: Number(el.dataset.y) }));
}

/** Arrow-key neighbour: rows above and below, along a row, and in and out of the peer columns. */
function neighbour(nodes: NodeInfo[], from: NodeInfo, dir: Dir): NodeInfo | null {
  const isPeer = (n: NodeInfo) => n.kind === "peer-left" || n.kind === "peer-right";
  const nearest = (list: NodeInfo[], axis: "x" | "y", value: number) =>
    list.reduce<NodeInfo | null>((best, n) => (!best || Math.abs(n[axis] - value) < Math.abs(best[axis] - value) ? n : best), null);
  const centre = nodes.filter((n) => !isPeer(n));
  /** The nearest node (by x) in the first centre row above or below y. */
  const rowBeyond = (y: number, d: "up" | "down", x: number) => {
    const ys = [...new Set(centre.map((n) => n.y))].filter((v) => (d === "up" ? v < y : v > y)).sort((a, b) => (d === "up" ? b - a : a - b));
    return ys.length ? nearest(centre.filter((n) => n.y === ys[0]), "x", x) : null;
  };

  if (isPeer(from)) {
    const column = nodes.filter((n) => n.kind === from.kind).sort((a, b) => a.y - b.y);
    const i = column.indexOf(from);
    // Past the end of a column: on to the nearest coach in the first row above or below it.
    if (dir === "up") return column[i - 1] ?? rowBeyond(from.y, "up", from.x);
    if (dir === "down") return column[i + 1] ?? rowBeyond(from.y, "down", from.x);
    const towardCentre = from.kind === "peer-left" ? "right" : "left";
    return dir === towardCentre ? (nodes.find((n) => n.kind === "focal") ?? null) : null;
  }

  if (dir === "up" || dir === "down") return rowBeyond(from.y, dir, from.x);
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

/**
 * Put each dotted mark exactly under its inferred year and the range tooltip area over the range, from
 * the browser's own text metrics (the server places them from measured glyph widths). Skipped while a
 * diagram is hidden (the other breakpoint's layout), and redone when it shows.
 */
function measureMarks(root: HTMLElement) {
  for (const node of root.querySelectorAll<SVGGElement>("[data-node]")) {
    const range = node.querySelector<SVGTSpanElement>("[data-range]");
    if (!range) continue;
    let box: DOMRect;
    try {
      box = range.getBBox();
    } catch {
      continue;
    }
    if (!box.width) continue;
    const hit = node.querySelector<SVGRectElement>("[data-hit]");
    if (hit) {
      hit.setAttribute("x", String(box.x - 2));
      hit.setAttribute("width", String(box.width + 4));
    }
    for (const line of node.querySelectorAll<SVGLineElement>("[data-mark]")) {
      const part = node.querySelector<SVGTSpanElement>(`[data-part="${line.dataset.mark}"]`);
      if (!part) continue;
      try {
        const b = part.getBBox();
        if (!b.width) continue;
        line.setAttribute("x1", String(b.x + 0.75));
        line.setAttribute("x2", String(b.x + b.width - 0.75));
      } catch {
        /* keep the server position */
      }
    }
  }
}

type DiagramInteractionsProps = {
  children: ReactNode;
  /** Tap-sheet content per node key. */
  sheets: Record<string, SheetInfo>;
  /** Element that Escape returns focus to (visible and focusable). */
  exitTargetId: string;
  className?: string;
};

/**
 * Behaviour for the server-rendered tree SVGs (DESIGN.md §8.8). Keyboard: Tab enters at the focal coach
 * (one tab stop for the whole diagram), arrow keys move between rows and along them, Enter opens, Escape
 * returns to the page. Hovering or focusing a person shows their connectors (every copy of someone listed
 * twice) and fades the rest to 40%. Touch: a tap selects a coach and opens a sheet with the person row and
 * "Open profile"; drag pans and a pinch zooms. Zoom out / Zoom in / Reset buttons do the same without
 * gestures. A diagram wider than its card scrolls sideways, starting centred on the focal coach, with a
 * fade on the cut edge.
 */
export function DiagramInteractions({ children, sheets, exitTargetId, className }: DiagramInteractionsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef<string | null>(null);
  const pointer = useRef<string>("mouse");
  const [selected, setSelected] = useState<{ key: string; info: SheetInfo } | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; z0: number } | null>(null);
  const router = useRouter();

  function setTabStop(key: string | null) {
    const root = ref.current;
    if (!root) return;
    const nodes = readNodes(root);
    const stop = key ?? nodes[0]?.key;
    for (const el of root.querySelectorAll<SVGGElement>("[data-node]")) {
      for (const a of el.querySelectorAll("a")) a.setAttribute("tabindex", el.dataset.node === stop ? "0" : "-1");
    }
  }

  /** Highlight a person: every node of theirs (someone can sit in two groups) and their connectors. */
  function activate(key: string | null) {
    const root = ref.current;
    if (!root) return;
    const person = key ? root.querySelector<SVGGElement>(`[data-node="${CSS.escape(key)}"]`)?.dataset.person : null;
    const keys = new Set<string>();
    for (const el of root.querySelectorAll<SVGGElement>("[data-node]")) {
      const on = !!person && el.dataset.person === person;
      if (on) keys.add(el.dataset.node!);
      el.toggleAttribute("data-on", on && el.dataset.node !== key);
    }
    if (key) root.setAttribute("data-active", key);
    else root.removeAttribute("data-active");
    for (const p of root.querySelectorAll<SVGPathElement>("[data-ends]")) p.toggleAttribute("data-on", p.dataset.ends!.split(" ").some((k) => keys.has(k)));
  }

  /** The scroll cue: fade the edge the diagram continues past. */
  const updateMask = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const max = root.scrollWidth - root.clientWidth;
    const left = max > 1 && root.scrollLeft > 1;
    const right = max > 1 && root.scrollLeft < max - 1;
    const mask = left || right ? `linear-gradient(to right, ${left ? "transparent" : "black"}, black 32px, black calc(100% - 32px), ${right ? "transparent" : "black"})` : "";
    root.style.maskImage = mask;
    root.style.webkitMaskImage = mask;
  }, []);

  /** Scale the diagrams (their viewBox keeps the drawing sharp), keeping the point under `anchorX` in place. */
  const applyZoom = useCallback(
    (z: number, anchorX?: number) => {
      const root = ref.current;
      if (!root) return;
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
      const ax = anchorX ?? root.clientWidth / 2;
      const ratio = root.scrollWidth > 0 ? (root.scrollLeft + ax) / root.scrollWidth : 0.5;
      for (const svg of root.querySelectorAll<SVGSVGElement>("svg[data-diagram]")) {
        svg.style.width = `${Number(svg.getAttribute("width")) * next}px`;
        svg.style.height = `${Number(svg.getAttribute("height")) * next}px`;
      }
      root.scrollLeft = ratio * root.scrollWidth - ax;
      zoomRef.current = next;
      setZoom(next);
      updateMask();
    },
    [updateMask],
  );

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    setTabStop(null);
    let centred = false;
    const measure = () => {
      measureMarks(root);
      if (!centred && root.clientWidth > 0) {
        centred = true;
        const max = root.scrollWidth - root.clientWidth;
        if (max > 0) root.scrollLeft = max / 2;
      }
      updateMask();
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.addEventListener("scroll", updateMask, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", updateMask);
    };
  }, [updateMask]);

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
    // Touch (DESIGN.md §8.8): a tap selects the coach and opens a sheet with the person row and "Open
    // profile", since there is no hover tooltip on touch. Mouse and keyboard open the profile directly,
    // and so does a tap on the coach in the middle (the page header already says who that is).
    const node = nodeOf(a);
    const key = node?.dataset.node;
    const info = key ? sheets[key] : undefined;
    if (pointer.current === "touch" && key && info) {
      setSelected({ key, info });
      activate(key);
      return;
    }
    router.push(href);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    pointer.current = e.pointerType;
    if (e.pointerType !== "touch") return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: zoomRef.current };
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    const root = ref.current;
    if (!p || !root || touches.current.size !== 2) return;
    const [a, b] = [...touches.current.values()];
    const mid = (a.x + b.x) / 2 - root.getBoundingClientRect().left;
    applyZoom(p.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / p.d0), mid);
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) pinch.current = null;
  }

  const stepZoom = (d: 1 | -1) => {
    const z = zoomRef.current;
    const next = d > 0 ? ZOOMS.find((v) => v > z + 0.01) : [...ZOOMS].reverse().find((v) => v < z - 0.01);
    if (next) applyZoom(next);
  };
  const reset = () => {
    applyZoom(1);
    const root = ref.current;
    if (root) root.scrollLeft = (root.scrollWidth - root.clientWidth) / 2;
    updateMask();
  };

  const info = selected?.info;
  return (
    <>
      <div role="toolbar" aria-label="Zoom" aria-controls="tree-diagram-canvas" className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-1 text-caption text-fg-3" aria-live="polite">
          <span className="pointer-fine:hidden">Drag to pan, pinch to zoom · </span>
          <span className="num">{Math.round(zoom * 100)}%</span>
          <span className="sr-only"> zoom</span>
        </span>
        <Button variant="secondary" size="sm" onClick={() => stepZoom(-1)} aria-disabled={zoom <= ZOOM_MIN + 0.001 || undefined}>
          Zoom out
        </Button>
        <Button variant="secondary" size="sm" onClick={() => stepZoom(1)} aria-disabled={zoom >= ZOOM_MAX - 0.001 || undefined}>
          Zoom in
        </Button>
        <Button variant="ghost" size="sm" onClick={reset} aria-disabled={Math.abs(zoom - 1) < 0.001 || undefined}>
          Reset
        </Button>
      </div>
      <div
        ref={ref}
        id="tree-diagram-canvas"
        className={cn("touch-pan-x touch-pan-y overflow-x-auto overscroll-x-contain", className)}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
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
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (open) return;
          setSelected(null);
          activate(focused.current);
        }}
        title={info?.group ?? ""}
        footer={
          info && (
            <>
              <ButtonLink href={`/in/${info.slug}/tree`} icon={Network}>
                Coaching tree
              </ButtonLink>
              <ButtonLink href={`/in/${info.slug}`} variant="primary">
                Open profile
              </ButtonLink>
            </>
          )
        }
      >
        {info && <SheetPerson info={info} />}
      </Dialog>
    </>
  );
}

/** The person row in the tap sheet: avatar 40, name, title · program, range (dotted marks kept), relationship. */
function SheetPerson({ info }: { info: SheetInfo }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Avatar name={info.name} tintKey={info.slug} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-body font-semibold text-fg-1">{info.name}</span>
              {info.you && <Chip title="This is your profile">You</Chip>}
              {info.isDemo && <DemoLabel />}
            </span>
            <RangeText view={info.range} className="shrink-0 leading-5" />
          </div>
          {info.role && <p className="text-small text-fg-2">{info.role}</p>}
          <ContextLine icon={Network} className="mt-1">
            {info.relation}
          </ContextLine>
          {info.player && (
            <ContextLine icon={Flag}>
              {info.player.text}
              {info.player.range && (
                <>
                  {" "}
                  <RangeText view={info.player.range} className="text-caption font-normal" />
                </>
              )}
            </ContextLine>
          )}
        </div>
      </div>
      {info.why && <p className="mt-3 border-t border-divider pt-3 text-caption text-fg-3">{info.why}</p>}
    </div>
  );
}
