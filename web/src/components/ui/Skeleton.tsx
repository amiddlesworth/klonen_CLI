import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Skeletons (§8.0): static --hover blocks, no shimmer. Text lines are 10px tall at the text's
 * line-height rhythm, radius 4; circles for avatars, rounded squares for tiles. Max 3 rows per list.
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block rounded-xs bg-hover", className)} />;
}

/** One 10px line inside a box of the given line height (20px body, 18px small, 16px caption). */
export function SkeletonLine({ width = "100%", lineHeight = 20, className }: { width?: string | number; lineHeight?: 16 | 18 | 20 | 22; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex items-center", className)} style={{ height: lineHeight }}>
      <span className="block h-2.5 rounded-xs bg-hover" style={{ width }} />
    </span>
  );
}

export function SkeletonText({ lines = 2, widths = ["70%", "45%", "60%"], lineHeight = 20, className }: { lines?: number; widths?: string[]; lineHeight?: 16 | 18 | 20 | 22; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("block", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} lineHeight={lineHeight} />
      ))}
    </span>
  );
}

export function SkeletonAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return <span aria-hidden="true" className={cn("block shrink-0 rounded-full bg-hover", className)} style={{ width: size, height: size }} />;
}

export function SkeletonTile({ size = 40, className }: { size?: number; className?: string }) {
  const radius = size >= 56 ? 12 : size >= 40 ? 8 : size >= 32 ? 6 : 5;
  return <span aria-hidden="true" className={cn("block shrink-0 bg-hover", className)} style={{ width: size, height: size, borderRadius: radius }} />;
}

/** A loading region: aria-busy plus a visually hidden "Loading" label. */
export function SkeletonRegion({ label = "Loading", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Up to 3 person rows (avatar + 2 lines) separated by dividers. */
export function SkeletonRows({ rows = 3, avatar = 40, shape = "circle", className }: { rows?: 1 | 2 | 3; avatar?: number; shape?: "circle" | "tile"; className?: string }) {
  return (
    <ul aria-hidden="true" className={cn("divide-y divide-divider", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          {shape === "circle" ? <SkeletonAvatar size={avatar} /> : <SkeletonTile size={avatar} />}
          <SkeletonText className="flex-1" lines={2} widths={[i % 2 ? "52%" : "64%", i % 2 ? "70%" : "40%"]} />
        </li>
      ))}
    </ul>
  );
}
