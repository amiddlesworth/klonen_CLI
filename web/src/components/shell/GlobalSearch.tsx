"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { SearchField } from "@/components/ui/SearchField";
import { cn } from "@/lib/cn";
import { typeaheadOptions, type TypeaheadOption, type TypeaheadResponse } from "./typeahead";
import { TypeaheadPanel } from "./TypeaheadPanel";

type GlobalSearchProps = {
  /** "nav" (desktop top bar), "mobile" (phone top bar), "overlay" (tablet full-width search). */
  variant?: "nav" | "mobile" | "overlay";
  autoFocus?: boolean;
  /** Called after the search navigates or is dismissed (closes the tablet overlay). */
  onNavigate?: () => void;
  /** Listen for the "/" shortcut (default true; off for the overlay and gallery previews). */
  shortcut?: boolean;
  className?: string;
};

const PANEL = {
  nav: "absolute left-0 top-[calc(100%+4px)] w-[400px] min-w-full max-w-[480px]",
  overlay: "absolute inset-x-0 top-[calc(100%+4px)] max-w-[480px]",
  mobile: "fixed inset-x-2 top-[calc(var(--mtop-h)+4px)]",
};

/**
 * Global search with typeahead (§8.1 SearchField + Typeahead): people and programs from
 * /api/typeahead, ↑ ↓ Enter Esc, "/" focuses the visible field, Enter without a highlighted row
 * opens /search?q=. Works without JS as a GET form to /search.
 */
export function GlobalSearch({ variant = "nav", autoFocus, onNavigate, shortcut = true, className }: GlobalSearchProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // Results are kept with the term they answer: while the next term's fetch is in flight the
  // panel shows the loading skeleton, never the previous term's rows.
  const [fetched, setFetched] = useState<{ term: string; data: TypeaheadResponse } | null>(null);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const term = q.trim();
  const results = fetched?.term === term ? fetched.data : null;

  useEffect(() => {
    setActive(-1);
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      let data: TypeaheadResponse;
      try {
        const res = await fetch(`/api/typeahead?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        data = (await res.json()) as TypeaheadResponse;
      } catch {
        data = { people: [], programs: [] };
      }
      if (!ctrl.signal.aborted) setFetched({ term, data });
    }, 120);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  // "/" focuses the visible search field unless the user is typing somewhere.
  useEffect(() => {
    if (variant === "overlay" || !shortcut) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const el = inputRef.current;
      if (!el || el.getClientRects().length === 0) return;
      e.preventDefault();
      el.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [variant, shortcut]);

  const options = useMemo(() => typeaheadOptions(results, term), [results, term]);
  const showPanel = open && term.length >= 2;
  const listReady = showPanel && results !== null;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function go(option: TypeaheadOption | { kind: "all"; href: string }) {
    close();
    if (option.kind !== "all") setQ("");
    inputRef.current?.blur();
    router.push(option.href);
    onNavigate?.();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!options.length) return;
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a < 0 ? (d > 0 ? 0 : options.length - 1) : (a + d + options.length) % options.length));
    } else if (e.key === "Enter") {
      if (listReady && active >= 0 && options[active]) {
        e.preventDefault();
        go(options[active]);
      }
    } else if (e.key === "Escape") {
      if (showPanel) {
        e.preventDefault();
        close();
      } else if (q) {
        setQ("");
      } else {
        inputRef.current?.blur();
        onNavigate?.();
      }
    }
  }

  return (
    <form
      role="search"
      action="/search"
      className={cn("relative", variant === "mobile" && "flex min-w-0 flex-1", variant === "overlay" && "w-full", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (term) go({ kind: "all", href: `/search?q=${encodeURIComponent(term)}` });
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <SearchField
        variant={variant === "nav" ? "nav" : variant === "mobile" ? "mobile" : "block"}
        inputRef={inputRef}
        name="q"
        value={q}
        autoFocus={autoFocus}
        placeholder={variant === "mobile" ? "Search coaches, programs" : "Search coaches and programs"}
        aria-label="Search coaches and programs"
        role="combobox"
        aria-expanded={listReady}
        aria-controls={listReady ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={listReady && active >= 0 ? `${listId}-o${active}` : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showPanel && (
        <TypeaheadPanel
          term={term}
          results={results}
          options={options}
          active={active}
          listId={listId}
          onActivate={setActive}
          onPick={(o) => {
            close();
            if (o.kind !== "all") setQ("");
            onNavigate?.();
          }}
          className={cn("z-40 animate-pop-in", PANEL[variant])}
        />
      )}
    </form>
  );
}
