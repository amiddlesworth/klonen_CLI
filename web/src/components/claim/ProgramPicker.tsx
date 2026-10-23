"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CircleAlert, Search, X } from "lucide-react";
import { ConferenceBadge } from "@/components/data/Badges";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { cn } from "@/lib/cn";
import { conferenceShort } from "@/lib/format";
import { stateName } from "@/components/profile/model";
import type { PickerProgram } from "@/lib/queries/claim";

type ProgramPickerProps = {
  id: string;
  /** Registry programs that may be chosen (the current program is already left out). */
  programs: PickerProgram[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** The coach's current program: named in the help text, and in the list when a search matches it. */
  excluded: PickerProgram | null;
  error?: string | null;
};

const MAX_RESULTS = 8;

const words = (text: string | null | undefined) => (text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Relevance tier for a query (lower is better), or null when the program doesn't match:
 * 1 name or short name starts with it · 2 a word in the name or short name starts with it ·
 * 3 conference abbreviation or state (abbreviation or full name) is exactly it · 4 a word in the
 * conference's full name starts with it. A multi-word query that matches none of these as a whole
 * still matches (tier 5) when every word matches one of them on its own.
 */
function tier(p: PickerProgram, q: string): number | null {
  const name = p.name.toLowerCase();
  const short = p.shortName.toLowerCase();
  if (name.startsWith(q) || short.startsWith(q)) return 1;
  const nameText = ` ${words(p.name).join(" ")} ${words(p.shortName).join(" ")}`;
  const qText = words(q).join(" ");
  if (qText && nameText.includes(` ${qText}`)) return 2;
  const abbr = (conferenceShort(p.conferenceAbbr) ?? "").toLowerCase();
  const exact = [abbr, (p.conferenceAbbr ?? "").toLowerCase(), (p.state ?? "").toLowerCase(), (stateName(p.state) ?? "").toLowerCase()];
  if (exact.includes(q)) return 3;
  if (qText && ` ${words(p.conference).join(" ")}`.includes(` ${qText}`)) return 4;
  return null;
}

function rank(p: PickerProgram, query: string): number | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return null;
  const whole = tier(p, q);
  if (whole !== null) return whole;
  const terms = q.split(" ");
  return terms.length > 1 && terms.every((t) => tier(p, t) !== null) ? 5 : null;
}

/**
 * Program multi-select combobox (§8.12 "Specific programs"): chosen programs as removable tokens,
 * then a search field with a listbox of matches (tile 24, name, conference · state). Keyboard:
 * ↑ ↓ to move, Enter to add, Esc to close; each token has its own remove button.
 * The open list stays on screen: on phone, focusing the field scrolls the picker (label, chosen
 * programs, field) to the top, under the 48px top bar, where the list has room above the keyboard; on every width the open list is scrolled
 * into view (clear of the phone tab bar) so its last row and the "Showing 8 of n" line are visible.
 */
export function ProgramPicker({ id, programs, selected, onChange, excluded, error }: ProgramPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const byId = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const chosen = selected.map((sid) => byId.get(sid)).filter((p): p is PickerProgram => !!p);

  // Rank every match, alphabetical within a tier, then show the first MAX_RESULTS and say so.
  const { results, total, excludedMatches } = useMemo(() => {
    if (!query.trim()) return { results: [], total: 0, excludedMatches: false };
    const ranked = programs
      .filter((p) => !selected.includes(p.id))
      .map((p) => ({ p, t: rank(p, query) }))
      .filter((r): r is { p: PickerProgram; t: number } => r.t !== null)
      .sort((a, b) => a.t - b.t || a.p.name.localeCompare(b.p.name));
    // Mention the current program only when it would have been among the shown results.
    const t = excluded ? rank(excluded, query) : null;
    const ahead = t === null ? 0 : ranked.filter((r) => r.t < t || (r.t === t && r.p.name.localeCompare(excluded!.name) < 0)).length;
    return {
      results: ranked.slice(0, MAX_RESULTS).map((r) => r.p),
      total: ranked.length,
      excludedMatches: t !== null && ahead < MAX_RESULTS,
    };
  }, [programs, query, selected, excluded]);

  const expanded = open && query.trim().length > 0;
  const helpId = `${id}-help`;

  // Bring the whole open list into view when it opens or grows (a no-op when it already fits).
  useEffect(() => {
    if (expanded) listRef.current?.scrollIntoView({ block: "nearest" });
  }, [expanded, results.length, total, excludedMatches]);

  function onFocus() {
    setOpen(true);
    if (window.matchMedia("(max-width: 720px)").matches) rootRef.current?.scrollIntoView({ block: "start" });
  }
  const errorId = `${id}-error`;

  function add(p: PickerProgram) {
    onChange([...selected, p.id]);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function remove(p: PickerProgram) {
    onChange(selected.filter((s) => s !== p.id));
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (expanded && results[active]) add(results[active]);
    } else if (e.key === "Escape") {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Backspace" && !query && chosen.length) {
      remove(chosen[chosen.length - 1]);
    }
  }

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-1.5 max-md:scroll-mt-[calc(var(--mtop-h)+12px)]">
      <label htmlFor={id} className="text-small font-medium text-fg-1">
        Programs that can see it
      </label>

      {chosen.length > 0 ? (
        <ul aria-label="Chosen programs" className="flex flex-wrap gap-2">
          {chosen.map((p) => (
            <li key={p.id} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-sm bg-hover pl-1 pr-0.5 text-small font-medium max-md:h-10">
              <OrgMark shortName={p.shortName} name={p.name} size={24} />
              <span className="min-w-0 truncate">{p.shortName}</span>
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label={`Remove ${p.name}`}
                title={`Remove ${p.name}`}
                className="relative grid size-7 shrink-0 place-items-center rounded-xs text-fg-2 hover:bg-pressed hover:text-fg-1 before:absolute before:-inset-1.5 max-md:size-9"
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-fg-3">No programs chosen yet.</p>
      )}

      <div className="relative">
        <Icon icon={Search} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-2" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && results[active] ? `${listId}-${results[active].id}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helpId}
          autoComplete="off"
          placeholder="Search programs, conferences or states"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={onFocus}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(CONTROL_CLASSES, "h-9 pl-9 max-md:h-11")}
        />
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Matching programs"
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 scroll-mb-4 overflow-y-auto rounded-md bg-surface p-1 shadow-pop max-md:scroll-mb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+8px)]"
        >
          {results.length === 0 && !excludedMatches ? (
            <li role="presentation" className="px-2 py-2.5 text-small text-fg-2">
              No programs match &lsquo;{query.trim()}&rsquo;. Try a school, conference or state.
            </li>
          ) : (
            results.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => add(p)}
                className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5", i === active && "bg-accent-subtle")}
              >
                <OrgMark shortName={p.shortName} name={p.name} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-medium">{p.name}</span>
                  <span className="flex items-center gap-1.5 text-caption text-fg-3">
                    <ConferenceBadge abbr={p.conferenceAbbr} name={p.conference} />
                    {p.state}
                  </span>
                </span>
              </li>
            ))
          )}
          {excludedMatches && excluded && (
            <li role="presentation" onMouseDown={(e) => e.preventDefault()} className="px-2 py-2 text-caption text-fg-3">
              <span className="whitespace-nowrap">{excluded.shortName}</span> is your current program, so it can&apos;t be added.
            </li>
          )}
          {total > results.length && (
            // Pinned to the bottom of the scrolling list so the count is visible without scrolling.
            <li
              role="presentation"
              onMouseDown={(e) => e.preventDefault()}
              className="num sticky -bottom-1 -mx-1 -mb-1 border-t border-divider bg-surface px-3 pb-2.5 pt-2 text-caption text-fg-3"
            >
              Showing {results.length} of {total}. Keep typing to narrow.
            </li>
          )}
        </ul>
      </div>

      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-caption text-danger">
          <Icon icon={CircleAlert} size={12} className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : (
        <p id={helpId} className="text-caption text-fg-3">
          Only people hiring for these programs see it.
          {excluded && (
            <>
              {" "}
              <span className="whitespace-nowrap">{excluded.shortName}</span> can&apos;t be added.
            </>
          )}
        </p>
      )}
    </div>
  );
}
