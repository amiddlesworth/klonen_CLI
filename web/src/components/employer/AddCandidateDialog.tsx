"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ListPlus, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { SampleChip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { SearchField } from "@/components/ui/SearchField";
import { SkeletonAvatar, SkeletonLine } from "@/components/ui/Skeleton";
import type { CandidateOptionsResponse } from "@/app/api/employers/candidates/route";
import { addToPipeline } from "@/lib/actions/employer";
import { cn } from "@/lib/cn";
import { titleShort } from "@/lib/format";
import type { CandidateOption } from "@/lib/queries/employer";
import { STAGE_LABEL, type PipelineStage } from "./stages";

type AddCandidateDialogProps = {
  open: boolean;
  onClose: () => void;
  /** The search on screen; null before the employer has one (the first add creates it). */
  shortlistId: number | null;
};

/**
 * "Add candidate" (§8.14 header action): find a coach by name or current program and add them to
 * the search on screen, in Sourced. Dialog on desktop, bottom sheet on phone. It stays open so
 * several coaches can be added in a row; the board behind it updates as each one is added.
 */
export function AddCandidateDialog({ open, onClose, shortlistId }: AddCandidateDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Add candidate"
      description="Find a coach by name or current program. Candidates start in Sourced."
      footer={(close) => <Button onClick={close}>Done</Button>}
    >
      {open && <CandidatePicker shortlistId={shortlistId} />}
    </Dialog>
  );
}

const MIN_CHARS = 2;
const FAILED = "Search didn't load.";
const ENDPOINT = "/api/employers/candidates";

type Results = { term: string; options: CandidateOption[]; more: boolean; limit: number };

/** "Hope · Defensive Coordinator and LB Coach": the program first and whole, then the title (§6.3 short form). */
function OptionMeta({ option: o }: { option: CandidateOption }) {
  const title = o.currentTitle ? titleShort(o.currentTitle) : null;
  if (!title && !o.orgShortName) return null;
  return (
    <p className="line-clamp-2 text-caption text-fg-2">
      {o.orgShortName && <span className="whitespace-nowrap">{o.orgShortName}</span>}
      {o.orgShortName && title && " · "}
      {title}
    </p>
  );
}

/** Mounted each time the dialog opens, so it starts empty. */
function CandidatePicker({ shortlistId }: { shortlistId: number | null }) {
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [added, setAdded] = useState<Record<string, PipelineStage>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const term = q.trim();

  // Focus the field once the dialog has opened (its showModal runs after this effect).
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  // Reads go through a GET route (not a server action), so they never queue behind mutations, and
  // each new term aborts the request for the one before it.
  useEffect(() => {
    if (term.length < MIN_CHARS) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term });
        if (shortlistId != null) params.set("list", String(shortlistId));
        const res = await fetch(`${ENDPOINT}?${params}`, { signal: ctrl.signal, cache: "no-store" });
        const body = (await res.json().catch(() => ({ error: FAILED }))) as CandidateOptionsResponse;
        if (ctrl.signal.aborted) return;
        if ("error" in body) {
          setError(body.error);
          setStatus(body.error);
        } else {
          setError(null);
          setResults({ term, ...body });
          const n = body.options.length;
          setStatus(
            n ? (body.more ? `Showing the first ${n} coaches` : `${n} ${n === 1 ? "coach" : "coaches"} found`) : `No coaches match ${term}`,
          );
        }
      } catch {
        if (ctrl.signal.aborted) return;
        setError(FAILED);
        setStatus(FAILED);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [term, shortlistId, retry]);

  async function add(o: CandidateOption) {
    setPendingId(o.id);
    try {
      const res = await addToPipeline(o.id, shortlistId ?? undefined);
      if (!res.ok) {
        setStatus(res.error);
        return;
      }
      setAdded((a) => ({ ...a, [o.id]: res.stage }));
      setStatus(res.alreadyAdded ? `${o.fullName} is already in ${STAGE_LABEL[res.stage]}` : `Added ${o.fullName} to ${STAGE_LABEL[res.stage]}`);
      inputRef.current?.focus();
    } catch {
      setStatus(`${o.fullName} wasn't added. Try again.`);
    } finally {
      setPendingId(null);
    }
  }

  // Results for an earlier term stay visible (dimmed, not clickable) until the new ones arrive, so
  // the list doesn't flash on every keystroke; an earlier "no match" gives way to the skeleton.
  const stale = !!results && results.term !== term;
  const options = results?.options ?? [];
  const showSkeleton = loading && (!results || (stale && !options.length));

  return (
    <div>
      <p id={labelId} className="mb-1.5 text-small font-medium">
        Name or program
      </p>
      <SearchField
        variant="block"
        inputRef={inputRef}
        aria-labelledby={labelId}
        placeholder="Search coaches"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={80}
      />
      <p role="status" className="sr-only">
        {status}
      </p>

      {/* Tall enough for three result rows, so the dialog keeps its size from empty to loaded. */}
      <div aria-busy={loading || undefined} className="mt-2 flex min-h-39 flex-col">
        {error ? (
          <ErrorState
            className="mt-2"
            message={error}
            action={
              <Button variant="ghost" size="sm" onClick={() => setRetry((n) => n + 1)}>
                Try again
              </Button>
            }
          />
        ) : term.length < MIN_CHARS ? (
          <EmptyState
            icon={Search}
            title="Search by name or program."
            description="Type at least two letters, like a last name or a school."
            spacing="sm"
            className="my-auto"
          />
        ) : showSkeleton ? (
          <ul aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 border-t border-divider py-2.5 first:border-t-0">
                <SkeletonAvatar size={32} />
                <div className="min-w-0 flex-1">
                  <SkeletonLine width={i % 2 ? "40%" : "52%"} lineHeight={18} />
                  <SkeletonLine width={i % 2 ? "64%" : "72%"} lineHeight={16} />
                </div>
              </li>
            ))}
          </ul>
        ) : results && !options.length ? (
          <EmptyState icon={Search} title={`No coaches match ‘${results.term}’.`} description="Try a last name or a school." spacing="sm" className="my-auto" />
        ) : (
          <div inert={stale} className={cn("transition-opacity", stale && "opacity-50")}>
            <ul aria-label="Coaches">
              {options.map((o) => {
                const stage = added[o.id] ?? o.stage;
                const who = o.orgShortName ? `${o.fullName}, ${o.orgShortName}` : o.fullName;
                return (
                  <li key={o.id} className="flex items-center gap-3 border-t border-divider py-2.5 first:border-t-0">
                    <Avatar name={o.fullName} tintKey={o.slug} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2">
                        {/* The profile, to check the coach before adding (opens in place of the pipeline). */}
                        <Link href={`/in/${o.slug}`} className="target-24 min-w-0 truncate text-small font-semibold underline-offset-2 hover:underline">
                          {o.fullName}
                        </Link>
                        {o.isDemo && <SampleChip />}
                      </p>
                      <OptionMeta option={o} />
                    </div>
                    {stage ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-caption text-fg-2">
                        <Icon icon={Check} size={14} />
                        In {STAGE_LABEL[stage]}
                      </span>
                    ) : (
                      <Button icon={ListPlus} loading={pendingId === o.id} aria-label={`Add ${who}`} onClick={() => add(o)}>
                        Add
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {results?.more && (
              <p className="border-t border-divider pt-2.5 text-caption text-fg-3">
                Showing the first {results.limit}. Add more of the name or program to narrow it.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
