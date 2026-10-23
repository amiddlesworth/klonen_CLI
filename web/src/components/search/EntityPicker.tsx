"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { CircleAlert, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { CONTROL_CLASSES } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { SkeletonAvatar, SkeletonText } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { PickerCoach, PickerOrg } from "@/lib/queries/searchx";
import { searchHref, type SearchState } from "./params";
import { markSearchPending } from "./pending";

/**
 * A pickable program or coach. `name` is the visible label (a program's short name); `orgName` is a
 * program's full name, so its tile shows the same initials as everywhere else ("PU", not "PA").
 */
type Option = { slug: string; name: string; meta: string | null; shortName?: string; orgName?: string };

export type PickedEntity = Option;

type EntityPickerProps = {
  kind: "program" | "person";
  /** URL parameter: workedAt (program slug) or workedUnder (coach slug). */
  param: "workedAt" | "workedUnder";
  label: string;
  /** Current search, so a pick keeps every other filter. */
  state: SearchState;
  selected: PickedEntity | null;
  /** Free text the server could not match (no-JS submissions). */
  unmatched?: string | null;
  /** Prefix for element ids (the panel renders twice: desktop rail and phone sheet). */
  idPrefix: string;
};

const subscribe = () => () => {};

/** Where each picker reads its options (GET ?q=, JSON { options }): both fetch the same way. */
const OPTIONS_URL = { program: "/api/search/programs", person: "/api/search/coaches" } as const;

/**
 * Combobox facet (§8.7 "Worked at" / "Worked under"): programs from every organization with a coaching
 * stint (D-I, D-II, junior colleges, high schools too) with their coach counts; coaches with how many
 * coached under them, coaches with trees first. ↑ ↓ Enter Esc, picking navigates to the filtered URL.
 * A chosen value shows as a row with a remove link. Without JavaScript the field is a named text input
 * in the facet form; the page resolves the text.
 */
export function EntityPicker({ kind, param, label, state, selected, unmatched, idPrefix }: EntityPickerProps) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  // Set on pick; the parent keys the picker by the chosen slug, so the remount clears it.
  const [pending, setPending] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [fetched, setFetched] = useState<{ term: string; options: Option[] } | null>(null);
  // Open the list upward when the field sits near the bottom of the viewport (end of the rail).
  const [dropUp, setDropUp] = useState(false);
  const reactId = useId();
  const inputId = `${idPrefix}-${param}`;
  const listId = `${inputId}-list${reactId.replace(/:/g, "")}`;
  const helpId = `${inputId}-help`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const term = q.trim();
  const options = fetched?.term === term ? fetched.options : null;
  const noun = kind === "program" ? "programs" : "coaches";

  useEffect(() => {
    setActive(-1);
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      let opts: Option[] = [];
      try {
        const res = await fetch(`${OPTIONS_URL[kind]}?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        if (kind === "program") {
          const { options: found } = (await res.json()) as { options: PickerOrg[] };
          opts = found.map((o) => ({ slug: o.slug, name: o.shortName, meta: o.meta, shortName: o.shortName, orgName: o.name }));
        } else {
          const { options: found } = (await res.json()) as { options: PickerCoach[] };
          opts = found.map((p) => ({ slug: p.slug, name: p.name, meta: p.meta }));
        }
      } catch {
        opts = [];
      }
      if (!ctrl.signal.aborted) setFetched({ term, options: opts });
    }, 150);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [term, kind]);

  // Close when focus or a click leaves the picker.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function openList() {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setDropUp(window.innerHeight - r.bottom < 260 && r.top > window.innerHeight - r.bottom);
    setOpen(true);
  }

  function pick(o: Option) {
    setOpen(false);
    setQ(o.name);
    setPending(true);
    const href = searchHref(state, { [param]: o.slug });
    markSearchPending(href);
    router.push(href, { scroll: false });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const list = options ?? [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      if (list.length) setActive((a) => (a + 1) % list.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (list.length) setActive((a) => (a <= 0 ? list.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      // Never submit the facet form with half-typed text.
      e.preventDefault();
      const o = list[active] ?? (list.length === 1 ? list[0] : undefined);
      if (o) pick(o);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    }
  }

  if (selected) {
    const removeHref = searchHref(state, { [param]: null });
    const href = kind === "program" ? `/programs/${selected.slug}` : `/in/${selected.slug}`;
    return (
      <div className="min-w-0">
        <p className="mb-1 text-small font-semibold text-fg-1">{label}</p>
        <input type="hidden" name={param} value={selected.slug} />
        <div className="flex min-h-11 min-w-0 items-center gap-2.5 md:min-h-10">
          {kind === "person" ? <Avatar name={selected.name} tintKey={selected.slug} size={24} /> : <OrgMark shortName={selected.shortName ?? selected.name} name={selected.orgName ?? selected.name} size={24} />}
          <span className="min-w-0 flex-1">
            <Link href={href} className="block truncate text-small font-medium text-fg-1 underline-offset-2 hover:underline">
              {selected.name}
            </Link>
            {/* Program first, then the title, two lines at most: the program always survives the clamp. */}
            {selected.meta && (
              <span className="line-clamp-2 text-caption text-fg-3" title={selected.meta}>
                {selected.meta}
              </span>
            )}
          </span>
          <Link
            href={removeHref}
            scroll={false}
            aria-label={`Remove filter: ${label} ${selected.name}`}
            title="Remove filter"
            className="relative grid size-8 shrink-0 place-items-center rounded-sm text-fg-2 transition-colors hover:bg-hover hover:text-fg-1 max-md:size-11"
          >
            <Icon icon={X} size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const expanded = open && term.length >= 2;
  const activeId = expanded && options && active >= 0 ? `${listId}-o${active}` : undefined;

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <label htmlFor={inputId} className="mb-1 block text-small font-semibold text-fg-1">
        {label}
      </label>
      <div className="relative">
        <Icon icon={Search} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
        <input
          id={inputId}
          // Named only before hydration: the no-JS form submits the text; with JS a pick navigates.
          name={hydrated ? undefined : param}
          type="text"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={unmatched ? helpId : undefined}
          aria-invalid={unmatched ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={kind === "program" ? "Search programs" : "Search coaches"}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) openList();
          }}
          onFocus={openList}
          onKeyDown={onKeyDown}
          className={cn(CONTROL_CLASSES, "h-9 pl-9 max-md:h-11", pending && "pr-9")}
        />
        {pending && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner />
          </span>
        )}
        <div
          hidden={!expanded}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "absolute inset-x-0 z-40 max-h-80 overflow-y-auto rounded-md bg-surface p-1 text-fg-1 shadow-pop",
            dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {expanded && options === null ? (
            <div aria-busy="true" className="py-1">
              <span className="sr-only" role="status">
                Loading suggestions
              </span>
              {[0, 1].map((i) => (
                <div key={i} className="flex h-11 items-center gap-2.5 px-2">
                  <SkeletonAvatar size={24} />
                  <SkeletonText className="flex-1" lines={2} lineHeight={16} widths={[i ? "48%" : "62%", i ? "66%" : "40%"]} />
                </div>
              ))}
            </div>
          ) : null}
          <div id={listId} role="listbox" aria-label={label}>
            {expanded &&
              options?.map((o, i) => (
                <div
                  key={o.slug}
                  id={`${listId}-o${i}`}
                  role="option"
                  aria-selected={active === i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                  className={cn("flex h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-sm px-2", active === i ? "bg-accent-subtle" : "hover:bg-hover")}
                >
                  {kind === "person" ? <Avatar name={o.name} tintKey={o.slug} size={24} /> : <OrgMark shortName={o.shortName ?? o.name} name={o.orgName ?? o.name} size={24} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-medium leading-[18px] text-fg-1">{o.name}</span>
                    {o.meta && <span className="block truncate text-caption text-fg-3">{o.meta}</span>}
                  </span>
                </div>
              ))}
          </div>
          {expanded && options?.length === 0 && (
            <p className="px-2 py-2.5 text-small text-fg-2">
              No {noun} match ‘{term}’.
            </p>
          )}
        </div>
      </div>
      {unmatched && (
        <p id={helpId} className="mt-1 flex items-start gap-1 text-caption text-danger">
          <Icon icon={CircleAlert} size={12} className="mt-0.5" />
          <span>
            No {noun} match ‘{unmatched}’.
          </span>
        </p>
      )}
    </div>
  );
}
