"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Network } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
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

/**
 * Put each dotted mark exactly under its inferred year and the range tooltip area over the range, from
 * the browser's own text metrics (the server places them from estimated glyph widths). Skipped while the
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
  /** Element that Escape returns focus to (visible and focusable). */
  exitTargetId: string;
  className?: string;
};

/**
 * Behaviour for the server-rendered tree SVG (DESIGN.md §8.8): Tab enters at the focal coach (one tab
 * stop for the whole diagram), arrow keys move between rows and along them, Enter opens, Escape returns
 * to the page (focus moves to the diagram card, which shows its focus ring). Hovering or focusing a node
 * shows its merged highlight path and fades the rest to 40%. Links navigate client-side. A diagram wider
 * than its card scrolls horizontally, starting centred on the focal coach, with a fade on the cut edge.
 */
export function DiagramInteractions({ children, exitTargetId, className }: DiagramInteractionsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef<string | null>(null);
  const pointer = useRef<string>("mouse");
  const [selected, setSelected] = useState<{ key: string; slug: string; name: string; about: string; focal: boolean } | null>(null);
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
    for (const p of root.querySelectorAll<SVGPathElement>("[data-hl]")) p.toggleAttribute("data-on", !!key && p.dataset.hl === key);
  }

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    setTabStop(null);
    let centred = false;
    // When the diagram is wider than the card, fade the edge it continues past (a scroll cue).
    const update = () => {
      const max = root.scrollWidth - root.clientWidth;
      if (!centred && root.clientWidth > 0) {
        centred = true;
        if (max > 0) root.scrollLeft = max / 2;
      }
      const left = max > 1 && root.scrollLeft > 1;
      const right = max > 1 && root.scrollLeft < max - 1;
      const mask = left || right ? `linear-gradient(to right, ${left ? "transparent" : "black"}, black 32px, black calc(100% - 32px), ${right ? "transparent" : "black"})` : "";
      root.style.maskImage = mask;
      root.style.webkitMaskImage = mask;
    };
    const measure = () => {
      measureMarks(root);
      update();
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", update);
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
    // Touch (DESIGN.md §8.8): a tap selects the coach and opens a sheet with who they are and "Open
    // profile", since there is no hover tooltip on touch. Mouse and keyboard open the profile directly.
    const node = nodeOf(a);
    if (pointer.current === "touch" && node?.dataset.node) {
      const name = node.dataset.name ?? "";
      const label = a.querySelector("title")?.textContent ?? "";
      const about = label.startsWith(name) ? label.slice(name.length).replace(/^ \(you\)/, "").replace(/^[,.]\s*/, "") : label;
      setSelected({ key: node.dataset.node, slug: href.replace(/^\/in\//, ""), name, about, focal: node.dataset.kind === "focal" });
      activate(node.dataset.node);
      return;
    }
    router.push(href);
  }

  return (
    <div
      ref={ref}
      className={cn("overflow-x-auto overscroll-x-contain", className)}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onPointerDown={(e) => {
        pointer.current = e.pointerType;
      }}
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
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (open) return;
          setSelected(null);
          activate(focused.current);
        }}
        title={selected?.name ?? ""}
        description={selected?.about}
        footer={
          selected && (
            <>
              {!selected.focal && (
                <ButtonLink href={`/in/${selected.slug}/tree`} icon={Network}>
                  Coaching tree
                </ButtonLink>
              )}
              <ButtonLink href={`/in/${selected.slug}`} variant="primary">
                Open profile
              </ButtonLink>
            </>
          )
        }
      />
    </div>
  );
}
