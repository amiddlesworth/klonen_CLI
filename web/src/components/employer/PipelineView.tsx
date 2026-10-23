"use client";
import { useEffect, useMemo, useOptimistic, useRef, useState, useSyncExternalStore, useTransition, type DragEvent, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, ListPlus, Search, Users } from "lucide-react";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuLink } from "@/components/ui/MenuItems";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { moveCandidate, removeFromPipeline, restoreCandidate, saveCandidateNote } from "@/lib/actions/employer";
import { cn } from "@/lib/cn";
import type { Candidate, ShortlistSummary } from "@/lib/queries/employer";
import { AddCandidateDialog } from "./AddCandidateDialog";
import { CANDIDATE_DRAG_TYPE, CandidateCard } from "./CandidateCard";
import { NoteDialog } from "./NoteDialog";
import { PIPELINE_H1, STAGE_TABS } from "./PipelineFrame";
import { isDemoSearch, searchDisplayName, type SearchPreset } from "./presets";
import { QuickSearches } from "./QuickSearches";
import { isPipelineStage, PIPELINE_STAGES, STAGE_LABEL, type PipelineStage } from "./stages";

type PipelineViewProps = {
  /** The search on screen; null when the employer has none yet (the first Add candidate creates one). */
  shortlist: { id: number; name: string } | null;
  /** All of the employer's searches; a switcher appears when there are two or more. */
  shortlists: ShortlistSummary[];
  /** "Pacific (OR)" */
  programName: string | null;
  candidates: Candidate[];
  /** "Find candidates" target (a people search that returns results) and the quick searches. */
  findHref: string;
  presets: SearchPreset[];
};

type Op =
  | { type: "move"; entryId: number; stage: PipelineStage; position?: number }
  | { type: "remove"; entryId: number }
  | { type: "restore"; candidate: Candidate }
  | { type: "note"; entryId: number; note: string | null };

function reduce(state: Candidate[], op: Op): Candidate[] {
  switch (op.type) {
    case "move": {
      const end = op.position ?? Math.max(-1, ...state.filter((c) => c.stage === op.stage).map((c) => c.position)) + 1;
      return state.map((c) => (c.entryId === op.entryId ? { ...c, stage: op.stage, position: end } : c));
    }
    case "remove":
      return state.filter((c) => c.entryId !== op.entryId);
    case "restore":
      return state.some((c) => c.person.id === op.candidate.person.id) ? state : [...state, op.candidate];
    case "note":
      return state.map((c) => (c.entryId === op.entryId ? { ...c, note: op.note } : c));
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Cards can be dragged between columns from md (721px) up, where the columns sit side by side. */
const DRAG_QUERY = "(min-width: 721px)";
function subscribeDragQuery(onChange: () => void) {
  const mq = window.matchMedia(DRAG_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function useDragEnabled(): boolean {
  return useSyncExternalStore(
    subscribeDragQuery,
    () => window.matchMedia(DRAG_QUERY).matches,
    () => false,
  );
}
const FAILED = "That change didn't save. Try again.";
const PATH = "/employers/pipeline";

/**
 * Hiring pipeline (§8.14): header card (h1, search name or switcher, counts, Find candidates and
 * the primary Add candidate; quick searches from md) and the board. lg: four columns Sourced ·
 * Contacted · Interview · Offer; md: a 2×2 grid; phone: Tabs for the four stages (?stage=) at the
 * bottom of the header card, one column below, then the quick searches. From md, cards drag between
 * columns (the card's More menu is the keyboard and touch path). Moves, notes and removals are
 * server actions with optimistic updates and an Undo toast.
 */
export function PipelineView({ shortlist, shortlists, programName, candidates, findHref, presets }: PipelineViewProps) {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [items, apply] = useOptimistic(candidates, reduce);
  const [noteFor, setNoteFor] = useState<Candidate | null>(null);
  const [adding, setAdding] = useState(false);
  // Where keyboard focus goes after a card leaves its column: the moved card, else the column.
  const focusNext = useRef<{ entryId?: number; stage: PipelineStage } | null>(null);
  const dragEnabled = useDragEnabled();
  // The card being dragged and the column it would land in.
  const [drag, setDrag] = useState<{ entryId: number; from: PipelineStage } | null>(null);
  const [dropTarget, setDropTarget] = useState<PipelineStage | null>(null);

  const stageParam = searchParams.get("stage");
  const phoneStage: PipelineStage = isPipelineStage(stageParam) ? stageParam : "sourced";

  const byStage = useMemo(() => {
    const groups = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as Candidate[]])) as Record<PipelineStage, Candidate[]>;
    for (const c of items) groups[c.stage].push(c);
    for (const s of PIPELINE_STAGES) groups[s].sort((a, b) => a.position - b.position || a.entryId - b.entryId);
    return groups;
  }, [items]);
  // The Demo chip marks the seeded search itself, not the account (searches it creates are its own).
  const isDemo = shortlist ? isDemoSearch(shortlist.name) : false;
  const searchName = shortlist ? searchDisplayName(shortlist.name) : null;
  const total = items.length;
  const notes = items.filter((c) => c.note).length;

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    const raf = requestAnimationFrame(() => {
      const card = target.entryId != null ? document.getElementById(`candidate-${target.entryId}`) : null;
      if (card && card.getClientRects().length) card.focus();
      else document.getElementById(`stage-${target.stage}`)?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [items]);

  function stageHref(stage: PipelineStage): string {
    const p = new URLSearchParams(searchParams.toString());
    p.set("stage", stage);
    return `${PATH}?${p.toString()}`;
  }

  /**
   * Phone stage tabs are real links (?stage=, so a reload, a new tab or no JS lands on the same
   * stage); a plain click switches in place through the history API, which Next keeps in sync with
   * useSearchParams, so there is no server round trip and pending optimistic changes stay.
   */
  function onStageTabClick(e: MouseEvent<HTMLDivElement>) {
    const tab = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[role="tab"]');
    if (!tab || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.history.pushState(null, "", tab.href);
  }

  /** `back` is an Undo: return to an exact position, with no second Undo. */
  function move(c: Candidate, stage: PipelineStage, back?: { position: number }) {
    const from = { stage: c.stage, position: c.position };
    focusNext.current = { entryId: c.entryId, stage: from.stage };
    startTransition(async () => {
      apply({ type: "move", entryId: c.entryId, stage, position: back?.position });
      try {
        const res = await moveCandidate(c.entryId, stage, back?.position);
        if (!res.ok) return toast.show(res.error);
        toast.show(
          `Moved ${c.person.fullName} to ${STAGE_LABEL[stage]}`,
          back ? undefined : { actionLabel: "Undo", onAction: () => move({ ...c, stage }, from.stage, { position: from.position }) },
        );
      } catch {
        toast.show(FAILED);
      }
    });
  }

  function remove(c: Candidate) {
    focusNext.current = { stage: c.stage };
    startTransition(async () => {
      apply({ type: "remove", entryId: c.entryId });
      try {
        const res = await removeFromPipeline(c.entryId);
        if (!res.ok) return toast.show(res.error);
        toast.show(`Removed ${c.person.fullName} from the pipeline`, {
          actionLabel: "Undo",
          onAction: () =>
            startTransition(async () => {
              apply({ type: "restore", candidate: c });
              try {
                const back = await restoreCandidate(res.removed);
                toast.show(back.ok ? `${c.person.fullName} is back in ${STAGE_LABEL[c.stage]}` : back.error);
              } catch {
                toast.show(FAILED);
              }
            }),
        });
      } catch {
        toast.show(FAILED);
      }
    });
  }

  function saveNote(c: Candidate, text: string) {
    setNoteFor(null);
    const note = text.trim() ? text.trim() : null;
    if (note === (c.note ?? null)) return;
    startTransition(async () => {
      apply({ type: "note", entryId: c.entryId, note });
      try {
        const res = await saveCandidateNote(c.entryId, text);
        toast.show(res.ok ? (res.note ? `Note saved for ${c.person.fullName}` : `Note removed for ${c.person.fullName}`) : res.error);
      } catch {
        toast.show(FAILED);
      }
    });
  }

  function endDrag() {
    setDrag(null);
    setDropTarget(null);
  }

  /** Drop handlers for a stage column: any column but the card's own accepts it. */
  function dropProps(stage: PipelineStage) {
    const accepts = (e: DragEvent) => drag !== null && drag.from !== stage && e.dataTransfer.types.includes(CANDIDATE_DRAG_TYPE);
    return {
      onDragOver(e: DragEvent<HTMLElement>) {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dropTarget !== stage) setDropTarget(stage);
      },
      onDragLeave(e: DragEvent<HTMLElement>) {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget((t) => (t === stage ? null : t));
      },
      onDrop(e: DragEvent<HTMLElement>) {
        if (!accepts(e)) return;
        e.preventDefault();
        const c = items.find((i) => i.entryId === drag?.entryId);
        endDrag();
        if (c) move(c, stage);
      },
    };
  }

  const showBoard = shortlist !== null && total > 0;

  return (
    <>
      <Card as="section" aria-labelledby="pipeline-title" className="overflow-hidden">
        <div className="px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            {/* Grows into the free space, so the switcher truncates a search name only when it must. */}
            <div className="min-w-0 md:flex-1">
              <h1 id="pipeline-title" className={PIPELINE_H1}>
                Hiring pipeline
              </h1>
              {shortlist && searchName && (
                // One 32px row in both variants, so the meta line never moves.
                <div className="mt-1 flex h-8 min-w-0 items-center gap-2">
                  {shortlists.length > 1 ? (
                    <Menu
                      trigger={
                        <>
                          <span className="truncate">{searchName}</span>
                          {isDemo && <SampleChip />}
                          <Icon icon={ChevronDown} size={16} />
                        </>
                      }
                      triggerLabel={`Hiring search: ${searchName}${isDemo ? " (demo)" : ""}. Switch search`}
                      triggerClassName={cn(
                        buttonClasses({ variant: "ghost", phone: "none" }),
                        "-ml-3 max-w-full gap-2 text-subtitle font-semibold text-fg-1 max-md:before:absolute max-md:before:-inset-y-1.5",
                      )}
                      label="Hiring searches"
                      placement="bottom-start"
                      minWidth={260}
                    >
                      {shortlists.map((l) => (
                        <MenuLink
                          key={l.id}
                          href={`${PATH}?list=${l.id}`}
                          aria-current={l.id === shortlist.id ? "page" : undefined}
                          description={plural(l.count, "candidate", "candidates")}
                          trailing={l.id === shortlist.id ? <Icon icon={Check} size={16} className="text-fg-2" /> : undefined}
                        >
                          {searchDisplayName(l.name)}
                        </MenuLink>
                      ))}
                    </Menu>
                  ) : (
                    <>
                      <p className="min-w-0 truncate text-subtitle font-semibold">{searchName}</p>
                      {isDemo && <SampleChip />}
                    </>
                  )}
                </div>
              )}
              <p className={cn("text-small text-fg-2", !shortlist && "mt-0.5")}>
                {[programName, shortlist ? plural(total, "candidate", "candidates") : "No searches yet", notes ? plural(notes, "note", "notes") : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {/* Secondary then primary (§8.1); Add candidate is the view's one primary action. */}
            <div className="flex flex-wrap gap-2 max-md:[&>*]:shrink max-md:[&>*]:grow max-md:[&>*]:basis-36 md:shrink-0">
              <ButtonLink href={findHref} icon={Search} phone="large">
                Find candidates
              </ButtonLink>
              <Button variant="primary" icon={ListPlus} phone="large" onClick={() => setAdding(true)}>
                Add candidate
              </Button>
            </div>
          </div>
        </div>
        {/* Phone: the stage tabs and the board come first; the quick searches follow the board. */}
        <QuickSearches presets={presets} id="quick-searches-header" className="max-md:hidden" />
        {showBoard && (
          <div className="md:hidden" onClickCapture={onStageTabClick}>
            <Tabs
              label="Pipeline stages"
              className={STAGE_TABS}
              items={PIPELINE_STAGES.map((s) => ({ href: stageHref(s), label: STAGE_LABEL[s], count: byStage[s].length, active: s === phoneStage }))}
            />
          </div>
        )}
      </Card>

      {!showBoard ? (
        <Card padding="main">
          <EmptyState
            as="h2"
            icon={Users}
            title={shortlist ? "No candidates in this search yet." : "No hiring searches yet."}
            description={shortlist ? "Candidates you add start in Sourced." : "Your first candidate starts one, in Sourced."}
            spacing="lg"
          />
        </Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
          {PIPELINE_STAGES.map((s) => {
            const list = byStage[s];
            const slot = dropTarget === s;
            return (
              <section
                key={s}
                id={`stage-${s}`}
                tabIndex={-1}
                aria-labelledby={`stage-${s}-title`}
                {...(dragEnabled ? dropProps(s) : {})}
                className={cn("flex min-w-0 flex-col outline-offset-2 md:rounded-md md:bg-hover md:p-2", s !== phoneStage && "max-md:hidden")}
              >
                <h2 id={`stage-${s}-title`} className="flex items-baseline gap-2 px-1 pb-2 pt-0.5 text-small font-semibold max-md:sr-only">
                  {STAGE_LABEL[s]}
                  <span className="num font-normal text-fg-3">
                    {list.length}
                    <span className="sr-only"> {list.length === 1 ? "candidate" : "candidates"}</span>
                  </span>
                </h2>
                {list.length > 0 && (
                  <ol className="flex flex-col gap-2">
                    {list.map((c) => (
                      <li key={c.entryId}>
                        <CandidateCard
                          candidate={c}
                          onMove={move}
                          onRemove={remove}
                          onEditNote={setNoteFor}
                          draggable={dragEnabled}
                          dragging={drag?.entryId === c.entryId}
                          onDragStart={(card) => setDrag({ entryId: card.entryId, from: card.stage })}
                          onDragEnd={endDrag}
                        />
                      </li>
                    ))}
                  </ol>
                )}
                {slot ? (
                  // Where a dragged card will land: the end of this column (§8.14 drop slot).
                  <p aria-hidden="true" className={cn("flex h-16 items-center justify-center rounded-md border border-dashed border-control text-caption text-fg-3", list.length > 0 && "mt-2")}>
                    Move to {STAGE_LABEL[s]}
                  </p>
                ) : (
                  !list.length && (
                    <p className="border-y border-border bg-surface px-4 py-8 text-center text-small text-fg-3 md:border-0 md:bg-transparent md:py-6">
                      No candidates here yet.
                    </p>
                  )
                )}
              </section>
            );
          })}
        </div>
      )}

      {presets.length > 0 && (
        <Card className="overflow-hidden md:hidden">
          <QuickSearches presets={presets} id="quick-searches-phone" variant="card" />
        </Card>
      )}

      <NoteDialog candidate={noteFor} onClose={() => setNoteFor(null)} onSave={saveNote} />
      <AddCandidateDialog open={adding} onClose={() => setAdding(false)} shortlistId={shortlist?.id ?? null} />
    </>
  );
}
