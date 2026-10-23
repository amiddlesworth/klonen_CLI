"use client";
import Link from "next/link";
import { createContext, useContext, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Shows a click on an inbox row at once, before the server render of the new thread arrives: the
 * clicked row takes the selection (aria-current, --hover) and the open thread is dimmed and marked
 * busy until the page catches up.
 */

type Selection = { pendingId: string | null; choose: (id: string) => void };

const SelectionContext = createContext<Selection>({ pendingId: null, choose: () => {} });

/** Holds the row the viewer just clicked until the server's selection (`selectedId`) changes. */
export function InboxSelectionProvider({ selectedId, children }: { selectedId: string | null; children: ReactNode }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [shownId, setShownId] = useState(selectedId);
  // The new page arrived: its selection is the truth again.
  if (shownId !== selectedId) {
    setShownId(selectedId);
    setPendingId(null);
  }
  return (
    <SelectionContext.Provider value={{ pendingId: pendingId === selectedId ? null : pendingId, choose: setPendingId }}>{children}</SelectionContext.Provider>
  );
}

type InboxRowLinkProps = {
  threadId: string;
  href: string;
  /** The open thread, per the server. */
  selected: boolean;
  /** The selection came from the URL; an implicit (desktop-only) selection isn't highlighted on phone. */
  explicit: boolean;
  className?: string;
  children: ReactNode;
};

const DESKTOP = "(min-width: 721px)";

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True on md and up, where the thread desktop opens by default is on screen. False on the server. */
function useDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

/**
 * An inbox row link that takes the selection as soon as it's clicked. aria-current marks the
 * conversation on screen: an explicit or just-clicked selection, or the implicit (newest) one only
 * where it shows, on md and up (on the phone inbox no thread is open).
 */
export function InboxRowLink({ threadId, href, selected, explicit, className, children }: InboxRowLinkProps) {
  const { pendingId, choose } = useContext(SelectionContext);
  const desktop = useDesktop();
  const isSelected = pendingId ? pendingId === threadId : selected;
  const current = isSelected && (explicit || !!pendingId || desktop);
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    // A new tab or window leaves this page as it is.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    choose(threadId);
  }
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={current ? "true" : undefined}
      className={cn(className, isSelected && (explicit || pendingId ? "bg-hover" : "md:bg-hover"))}
    >
      {children}
    </Link>
  );
}

type ThreadPaneProps = {
  /** The thread shown in the pane (null for a new-message pane). */
  threadId: string | null;
  hiddenOnPhone: boolean;
  /** On the phone thread page, the pane fills the screen so the composer sits on the tab bar. */
  fillOnPhone?: boolean;
  label: string;
  children: ReactNode;
};

/** Thread column: header, messages (scrolling on md and up) and the composer. Dimmed while another thread loads. */
export function ThreadPane({ threadId, hiddenOnPhone, fillOnPhone, label, children }: ThreadPaneProps) {
  const { pendingId } = useContext(SelectionContext);
  const loading = pendingId !== null && pendingId !== threadId;
  return (
    <section
      aria-label={label}
      aria-busy={loading || undefined}
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        hiddenOnPhone && "max-md:hidden",
        // Top bar, the 8px canvas gap and the card's top and bottom borders above; tab bar and safe area below.
        fillOnPhone && "max-md:min-h-[calc(100dvh-var(--mtop-h)-var(--tabbar-h)-env(safe-area-inset-bottom)-10px)]",
        loading && "pointer-events-none opacity-60",
      )}
    >
      {children}
    </section>
  );
}
