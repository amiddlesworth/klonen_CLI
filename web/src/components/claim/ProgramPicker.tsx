"use client";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CircleAlert, Search, X } from "lucide-react";
import { ConferenceBadge } from "@/components/data/Badges";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { cn } from "@/lib/cn";
import { conferenceShort } from "@/lib/format";
import type { PickerProgram } from "@/lib/queries/claim";

type ProgramPickerProps = {
  id: string;
  /** Registry programs that may be chosen (the current program is already left out). */
  programs: PickerProgram[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** The coach's current program, named in the help text. */
  excludedName: string | null;
  error?: string | null;
};

const MAX_RESULTS = 8;

function matches(p: PickerProgram, terms: string[]) {
  const hay = `${p.name} ${p.shortName} ${conferenceShort(p.conferenceAbbr) ?? ""} ${p.conference ?? ""} ${p.state ?? ""}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

/**
 * Program multi-select combobox (§8.12 "Specific programs"): chosen programs as removable tokens,
 * then a search field with a listbox of matches (tile 24, name, conference · state). Keyboard:
 * ↑ ↓ to move, Enter to add, Esc to close; each token has its own remove button.
 */
export function ProgramPicker({ id, programs, selected, onChange, excludedName, error }: ProgramPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const byId = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const chosen = selected.map((sid) => byId.get(sid)).filter((p): p is PickerProgram => !!p);

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return programs.filter((p) => !selected.includes(p.id) && matches(p, terms)).slice(0, MAX_RESULTS);
  }, [programs, query, selected]);

  const expanded = open && query.trim().length > 0;
  const helpId = `${id}-help`;
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
    <div className="flex min-w-0 flex-col gap-1.5">
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
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn(CONTROL_CLASSES, "h-9 pl-9 max-md:h-11")}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching programs"
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-md bg-surface p-1 shadow-pop"
        >
          {results.length === 0 ? (
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
        </ul>
      </div>

      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-caption text-danger">
          <Icon icon={CircleAlert} size={12} className="mt-0.5" />
          <span>{error}</span>
        </p>
      ) : (
        <p id={helpId} className="text-caption text-fg-3">
          Only people hiring for these programs see it.{excludedName ? ` ${excludedName} can't be added.` : ""}
        </p>
      )}
    </div>
  );
}
