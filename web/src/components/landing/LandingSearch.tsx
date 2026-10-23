"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { TypeaheadPanel } from "@/components/shell/TypeaheadPanel";
import { typeaheadOptions, type TypeaheadOption, type TypeaheadResponse } from "@/components/shell/typeahead";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * Landing search (§8.10): a 48px field (radius 8, 1px --control) with the primary "Search" button
 * inside on the right; on phone the button sits below at full width. People and programs typeahead
 * from /api/typeahead (↑ ↓ Enter Esc, same panel as the global search). Without JS it is a GET form
 * to /search?q=.
 */
export function LandingSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // Results are kept with the term they answer, so a stale term's rows never show.
  const [fetched, setFetched] = useState<{ term: string; data: TypeaheadResponse } | null>(null);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();
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

  const options = useMemo(() => typeaheadOptions(results, term), [results, term]);
  const showPanel = open && term.length >= 2;
  const listReady = showPanel && results !== null;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function go(option: TypeaheadOption | { kind: "all"; href: string }) {
    close();
    inputRef.current?.blur();
    router.push(option.href);
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
      }
    }
  }

  return (
    <form
      role="search"
      action="/search"
      aria-label="Search coaches and programs"
      className={cn("w-full text-left", className)}
      onSubmit={(e) => {
        e.preventDefault();
        go({ kind: "all", href: term ? `/search?q=${encodeURIComponent(term)}` : "/search" });
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <div className="relative">
        {/* Clicking anywhere in the field box (icon, padding) focuses the input. */}
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget || !(e.target as HTMLElement).closest("button,input")) {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
          className={cn(
            "flex h-12 cursor-text items-center gap-2.5 rounded-md border border-control bg-surface pl-4 pr-1.5 text-fg-3 transition-colors max-md:pr-3",
            "hover:border-fg-3 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-subtle)] focus-within:hover:border-accent",
          )}
        >
          <Icon icon={Search} size={20} />
          <label htmlFor={inputId} className="sr-only">
            Search coaches and programs
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            name="q"
            value={q}
            placeholder="Search coaches and programs"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
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
            className="h-full w-0 min-w-0 flex-1 truncate bg-transparent text-subtitle text-fg-1 placeholder:text-fg-3 focus-visible:outline-none max-md:text-base"
          />
          <Button type="submit" variant="primary" className="h-9 px-4 max-md:hidden">
            Search
          </Button>
        </div>
        {showPanel && (
          <TypeaheadPanel
            term={term}
            results={results}
            options={options}
            active={active}
            listId={listId}
            onActivate={setActive}
            onPick={close}
            className="absolute inset-x-0 top-[calc(100%+4px)] z-40 animate-pop-in"
          />
        )}
      </div>
      <Button type="submit" variant="primary" phone="large" fullWidth className="mt-2 md:hidden">
        Search
      </Button>
    </form>
  );
}
