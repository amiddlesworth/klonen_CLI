"use client";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Search, Users } from "lucide-react";
import { StatGroup } from "@/components/data/StatGroup";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuLink } from "@/components/ui/MenuItems";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextLink } from "@/components/ui/TextLink";
import { useToast } from "@/components/ui/Toast";
import { moveCandidate, removeFromPipeline, restoreCandidate, saveCandidateNote } from "@/lib/actions/employer";
import { cn } from "@/lib/cn";
import type { Candidate, ShortlistSummary } from "@/lib/queries/employer";
import { CandidateCard } from "./CandidateCard";
import { NoteDialog } from "./NoteDialog";
import { searchDisplayName, type SearchPreset } from "./presets";
import { PIPELINE_STAGES, STAGE_LABEL, type PipelineStage } from "./stages";

type PipelineViewProps = {
  shortlist: { id: number; name: string };
  /** All of the employer's searches; a switcher appears when there are two or more. */
  shortlists: ShortlistSummary[];
  /** "Pacific (OR)" */
  programName: string | null;
  candidates: Candidate[];
  /** Stage shown first on phone (?stage=). */
  initialStage: PipelineStage;
  /** Primary "Find candidates" target and the quick-search presets under the header. */
  findHref: string;
  presets: SearchPreset[];
  /** The search is a seeded demo record: dashed Demo chip next to its name. */
  isDemo: boolean;
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
const FAILED = "That change didn't save. Try again.";

/**
 * Hiring pipeline (§8.14): header card (search name, counts, Find candidates, quick searches) and
 * the board. lg: four columns Sourced · Contacted · Interview · Offer; md: a 2×2 grid; phone: a
 * segmented control shows one stage at a time. Moves, notes and removals are server actions with
 * optimistic updates and an Undo toast.
 */
export function PipelineView({ shortlist, shortlists, programName, candidates, initialStage, findHref, presets, isDemo }: PipelineViewProps) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [items, apply] = useOptimistic(candidates, reduce);
  const [phoneStage, setPhoneStage] = useState<PipelineStage>(initialStage);
  const [noteFor, setNoteFor] = useState<Candidate | null>(null);
  // Where keyboard focus goes after a card leaves its column: the moved card, else the column.
  const focusNext = useRef<{ entryId?: number; stage: PipelineStage } | null>(null);

  const byStage = useMemo(() => {
    const groups = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as Candidate[]])) as Record<PipelineStage, Candidate[]>;
    for (const c of items) groups[c.stage].push(c);
    for (const s of PIPELINE_STAGES) groups[s].sort((a, b) => a.position - b.position || a.entryId - b.entryId);
    return groups;
  }, [items]);
  const searchName = searchDisplayName(shortlist.name, isDemo);
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

  return (
    <>
      <Card as="section" aria-labelledby="pipeline-title" className="overflow-hidden">
        <div className="px-4 pt-4 md:px-6 md:pt-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0">
              <h1 id="pipeline-title" className="text-display-sm md:text-display">
                Hiring pipeline
              </h1>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {shortlists.length > 1 ? (
                  <Menu
                    trigger={
                      <>
                        <span className="truncate">{searchName}</span>
                        <Icon icon={ChevronDown} size={16} />
                      </>
                    }
                    triggerLabel={`Hiring search: ${searchName}. Switch search`}
                    triggerClassName={cn(buttonClasses({ variant: "ghost" }), "-ml-3 -mr-1.5 max-w-full text-subtitle font-semibold text-fg-1")}
                    label="Hiring searches"
                    placement="bottom-start"
                    minWidth={260}
                  >
                    {shortlists.map((l) => (
                      <MenuLink
                        key={l.id}
                        href={`/employers/pipeline?list=${l.id}`}
                        aria-current={l.id === shortlist.id ? "page" : undefined}
                        description={plural(l.count, "candidate", "candidates")}
                        trailing={l.id === shortlist.id ? <Icon icon={Check} size={16} className="text-fg-2" /> : undefined}
                      >
                        {searchDisplayName(l.name, isDemo)}
                      </MenuLink>
                    ))}
                  </Menu>
                ) : (
                  <p className="min-w-0 text-subtitle font-semibold">{searchName}</p>
                )}
                {isDemo && <SampleChip />}
              </div>
              <p className="mt-0.5 text-small text-fg-2">
                {[programName, plural(total, "candidate", "candidates"), notes ? plural(notes, "note", "notes") : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <ButtonLink href={findHref} variant="primary" icon={Search} phone="large" className="max-md:w-full">
              Find candidates
            </ButtonLink>
          </div>
          <StatGroup
            label="Candidates by stage"
            className="mt-4 max-md:hidden"
            stats={PIPELINE_STAGES.map((s) => ({ value: byStage[s].length, label: STAGE_LABEL[s] }))}
          />
        </div>
        {presets.length > 0 && (
          <nav
            aria-label="Quick searches"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-divider bg-surface-2 px-4 py-2.5 text-small max-md:mt-4 md:px-6"
          >
            <span className="inline-flex items-center gap-1.5 text-fg-2">
              <Icon icon={Search} size={16} />
              Quick searches
            </span>
            {presets.map((p) => (
              <TextLink key={p.href} href={p.href} target24>
                {p.label}
              </TextLink>
            ))}
          </nav>
        )}
      </Card>

      {total === 0 ? (
        <Card padding="main">
          <EmptyState
            as="h2"
            icon={Users}
            title="No candidates in this search yet."
            description="Use Find candidates to search coaches, then add them from a profile or a search result. They start in Sourced."
            spacing="lg"
          />
        </Card>
      ) : (
        <>
          <div className="px-4 pt-1 md:hidden">
            <SegmentedControl
              label="Pipeline stage"
              value={phoneStage}
              onChange={(v) => setPhoneStage(v as PipelineStage)}
              options={PIPELINE_STAGES.map((s) => ({ value: s, label: `${STAGE_LABEL[s]} ${byStage[s].length}` }))}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
            {PIPELINE_STAGES.map((s) => {
              const list = byStage[s];
              return (
                <section
                  key={s}
                  id={`stage-${s}`}
                  tabIndex={-1}
                  aria-labelledby={`stage-${s}-title`}
                  className={cn("flex min-w-0 flex-col outline-offset-2 md:rounded-md md:bg-hover md:p-2", s !== phoneStage && "max-md:hidden")}
                >
                  <h2 id={`stage-${s}-title`} className="flex items-baseline gap-2 px-1 pb-2 pt-0.5 text-small font-semibold max-md:sr-only">
                    {STAGE_LABEL[s]}
                    <span className="num font-normal text-fg-3">
                      {list.length}
                      <span className="sr-only"> {list.length === 1 ? "candidate" : "candidates"}</span>
                    </span>
                  </h2>
                  {list.length ? (
                    <ol className="flex flex-col gap-2">
                      {list.map((c) => (
                        <li key={c.entryId}>
                          <CandidateCard candidate={c} onMove={move} onRemove={remove} onEditNote={setNoteFor} />
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="border-y border-border bg-surface px-4 py-8 text-center text-small text-fg-3 md:border-0 md:bg-transparent md:py-6">
                      No candidates here yet.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      <NoteDialog candidate={noteFor} onClose={() => setNoteFor(null)} onSave={saveNote} />
    </>
  );
}
