"use client";
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

const SetSummaryContext = createContext<((node: ReactNode) => void) | null>(null);
const SummaryContext = createContext<ReactNode>(null);

/** Holds the page-provided Me menu summary (AppShell renders it around the whole app). */
export function MeMenuSummaryProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<ReactNode>(null);
  return (
    <SetSummaryContext.Provider value={setSummary}>
      <SummaryContext.Provider value={summary}>{children}</SummaryContext.Provider>
    </SetSummaryContext.Provider>
  );
}

/** The current page's Me menu summary, or null. */
export function useMeMenuSummary(): ReactNode {
  return useContext(SummaryContext);
}

/**
 * Puts content at the top of the desktop Me menu at tablet width (721–1080px), where the feed's
 * left rail is hidden: §8.2 "left rail moves into the Me menu". Renders nothing in place; the
 * content leaves the menu when the page unmounts. Use it from a page, for example the feed:
 *
 *   <MeMenuSummary><MiniProfileStats … /></MeMenuSummary>
 *
 * Keep it short (key-value rows and the Open to opportunities line), with no headings.
 */
export function MeMenuSummary({ children }: { children: ReactNode }) {
  const setSummary = useContext(SetSummaryContext);
  useLayoutEffect(() => {
    if (!setSummary) return;
    setSummary(children);
    return () => setSummary(null);
  }, [setSummary, children]);
  return null;
}
