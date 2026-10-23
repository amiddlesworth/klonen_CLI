"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

/*
 * Visible feedback while a facet change navigates (§8.0 Loading). The facet form, the pickers and the
 * filter sheet mark the search as pending with the URL they navigate away from; results dim and the
 * Filters button shows a spinner until the URL changes. Same-route navigations keep the old results on
 * screen (no skeleton), so without this a slow response looks like nothing happened.
 */

let from: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function currentSearchUrl(): string {
  return typeof window === "undefined" ? "" : window.location.pathname + window.location.search;
}

/** Call right before router.push(href): pending until the URL is no longer the current one. */
export function markSearchPending(href: string) {
  const now = currentSearchUrl();
  if (href === now) return;
  from = now;
  emit();
}

export function isSearchPending(): boolean {
  return from !== null && from === currentSearchUrl();
}

/** True from a facet change until its navigation commits. */
export function useSearchPending(): boolean {
  const pendingFrom = useSyncExternalStore(subscribe, () => from, () => null);
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.size ? `${pathname}?${params.toString()}` : pathname;
  useEffect(() => {
    // The URL moved on (the push committed, or another link was followed): clear.
    if (from !== null && from !== current) {
      from = null;
      emit();
    }
  }, [pendingFrom, current]);
  return pendingFrom !== null && pendingFrom === current;
}
