"use client";
import { useSyncExternalStore } from "react";

/*
 * Per-viewer feed preferences kept in this browser (demo: nothing is sent to the server): the kinds
 * of items hidden with "Hide moves like this", and items saved from the More menu. localStorage when
 * available, memory otherwise; every reader on the page shares one small store per key.
 */

/** What "Hide moves like this" hides: every item of the same kind. */
export type HideKind = "hire" | "promotion" | "role-change" | "milestone";

export const HIDE_KIND_NOUN: Record<HideKind, string> = {
  hire: "New hires",
  promotion: "Promotions",
  "role-change": "Role changes",
  milestone: "Milestones",
};

function createListStore<T extends string>(key: string, limit: number) {
  const listeners = new Set<() => void>();
  let memory: T[] | null = null;
  const EMPTY: T[] = [];

  function read(): T[] {
    if (memory) return memory;
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      memory = Array.isArray(parsed) ? (parsed.filter((x) => typeof x === "string") as T[]) : [];
    } catch {
      memory = [];
    }
    return memory;
  }

  function write(list: T[]) {
    memory = list.slice(-limit);
    try {
      window.localStorage.setItem(key, JSON.stringify(memory));
    } catch {
      // Storage blocked (private window): the in-memory copy still works for this page view.
    }
    listeners.forEach((l) => l());
  }

  function subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        memory = null;
        l();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    use: () => useSyncExternalStore(subscribe, read, () => EMPTY),
    add: (v: T) => {
      const cur = read();
      if (!cur.includes(v)) write([...cur, v]);
    },
    remove: (v: T) => write(read().filter((x) => x !== v)),
    has: (v: T) => read().includes(v),
  };
}

const hidden = createListStore<HideKind>("cn-feed-hidden-kinds", 10);
const saved = createListStore<string>("cn-feed-saved-items", 500);

/** Kinds the viewer hid with "Hide moves like this". */
export const useHiddenKinds = hidden.use;
export const hideKind = hidden.add;
export const showKind = hidden.remove;

/** Whether a feed item is saved from its More menu, and a toggle that returns the new state. */
export function useSavedItem(key: string): [boolean, () => boolean] {
  const list = saved.use();
  const toggle = () => {
    if (saved.has(key)) {
      saved.remove(key);
      return false;
    }
    saved.add(key);
    return true;
  };
  return [list.includes(key), toggle];
}
