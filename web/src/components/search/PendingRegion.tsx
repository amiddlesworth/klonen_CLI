"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useSearchPending } from "./pending";

/** Results while a facet change loads: dimmed and aria-busy, so a slow response still shows progress. */
export function PendingRegion({ children, className }: { children: ReactNode; className?: string }) {
  const pending = useSearchPending();
  return (
    <div aria-busy={pending || undefined} className={cn(pending && "pointer-events-none opacity-50", className)}>
      {pending && (
        <span className="sr-only" role="status">
          Updating results
        </span>
      )}
      {children}
    </div>
  );
}
