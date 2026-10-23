"use client";
import Link from "next/link";
import { useId, useRef, type DragEvent } from "react";
import { ArrowRight, Building2, Ellipsis, Flag, Network, Pencil, StickyNote, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuDivider, MenuGroup, MenuItem, MenuLink, MenuRadioItem } from "@/components/ui/MenuItems";
import { cn } from "@/lib/cn";
import { titleShort } from "@/lib/format";
import type { Candidate, CandidateContext } from "@/lib/queries/employer";
import { nextStage, PIPELINE_STAGES, STAGE_LABEL, type PipelineStage } from "./stages";
import { atProgram, keepTogether } from "./text";

/** dataTransfer type of a card being dragged between columns. */
export const CANDIDATE_DRAG_TYPE = "application/x-pipeline-candidate";

const CONTEXT_ICON: Record<CandidateContext["kind"], LucideIcon> = { tree: Network, previous: Building2, played: Flag };

type CandidateCardProps = {
  candidate: Candidate;
  onMove: (candidate: Candidate, stage: PipelineStage) => void;
  onRemove: (candidate: Candidate) => void;
  onEditNote: (candidate: Candidate) => void;
  /** md and up with a mouse: the card can be dragged to another column. */
  draggable: boolean;
  /** This card is the one being dragged (lifted with shadow-pop). */
  dragging: boolean;
  onDragStart: (candidate: Candidate) => void;
  onDragEnd: () => void;
};

/** "{Title} at {Program}" (§6.3 short form past 40 characters), or whichever half is known. The program never breaks inside itself. */
function roleLine(c: Candidate): string | null {
  const org = c.person.org?.shortName ?? null;
  // A break opportunity after each slash, so "Coordinator/Offensive Line" wraps at the slash.
  const title = c.person.currentTitle ? titleShort(c.person.currentTitle).replace(/\//g, "/\u200B") : null;
  if (title && org) return atProgram(title, org);
  return title ?? (org ? keepTogether(org) : null);
}

/**
 * One context line. The years are tied to the word before them with a no-break space, so they
 * never sit alone on the last line. An abbreviated title ("GA") is read out and shown on hover in
 * full.
 */
function CandidateContextLine({ line }: { line: CandidateContext }) {
  return (
    <ContextLine icon={CONTEXT_ICON[line.kind]} className="mt-1 break-words">
      {line.fullText ? (
        <>
          <span aria-hidden="true" title={line.fullText}>
            {line.text}
          </span>
          <span className="sr-only">{line.fullText}</span>
        </>
      ) : (
        line.text
      )}
      {line.years && (
        <>
          {line.yearsJoin === "since" ? "\u00A0since\u00A0" : ",\u00A0"}
          <span aria-hidden="true" className="num">
            {line.years}
          </span>
          <span className="sr-only">{line.yearsLabel}</span>
        </>
      )}
    </ContextLine>
  );
}

/**
 * Candidate card (§8.14). Header: avatar 32, name 13/600 (links to the profile) and the Demo chip.
 * Body: title at program 12 --fg-2 and the context lines (tree, previous stop); from lg it runs
 * the card's full width under the avatar, below it sits beside the avatar. The note sits on a
 * --surface-2 band that opens the note dialog. Footer: the next stage ("Move to Contacted →") and
 * More, which holds every move ("Move to"), the note, the profile link and Remove: the keyboard
 * and touch alternative to dragging the card between columns (md and up).
 */
export function CandidateCard({ candidate: c, onMove, onRemove, onEditNote, draggable, dragging, onDragStart, onDragEnd }: CandidateCardProps) {
  const nameId = useId();
  // Where the pointer went down: a drag that starts on a button is a click, not a move.
  const fromControl = useRef(false);
  const next = nextStage(c.stage);
  const { fullName, slug, isDemo } = c.person;
  const role = roleLine(c);
  const noteLabel = c.note ? "Edit note" : "Add note";

  function handleDragStart(e: DragEvent<HTMLElement>) {
    // A link inside the card drags its own URL; leave that alone.
    if (e.target !== e.currentTarget) return;
    if (fromControl.current) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(CANDIDATE_DRAG_TYPE, String(c.entryId));
    onDragStart(c);
  }

  return (
    <article
      id={`candidate-${c.entryId}`}
      tabIndex={-1}
      aria-labelledby={nameId}
      draggable={draggable || undefined}
      onPointerDown={(e) => (fromControl.current = !!(e.target as HTMLElement).closest("a, button, [role='menuitem']"))}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className={cn(
        "relative min-w-0 border-y border-border bg-surface outline-offset-2 md:rounded-md md:border",
        draggable && "md:cursor-grab md:active:cursor-grabbing",
        // Lifted while dragging: level 2 (surface + shadow-pop, no border).
        dragging && "shadow-pop md:border-transparent",
      )}
    >
      <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 px-4 pb-3 pt-3.5 md:px-3 md:pt-3">
        <Avatar name={fullName} tintKey={slug} size={32} className="row-span-2 lg:row-span-1 lg:self-center" />
        {/*
          The name row has the card's full width (More sits in the footer). Wide boards (from 1280px)
          and phone/tablet keep the Demo chip after the name; the narrow four-column board
          (1081–1279px) always puts it under the name, so every card on the board has the same shape.
        */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 lg:self-center lg:max-xl:flex-col lg:max-xl:items-start">
          <h3 id={nameId} className="min-w-0 break-words text-small font-semibold">
            <Link href={`/in/${slug}`} className="target-24 inline-block underline-offset-2 hover:underline">
              {fullName}
            </Link>
          </h3>
          {isDemo && <SampleChip />}
        </div>
        {(role || c.context.length > 0) && (
          <div className="min-w-0 lg:col-span-2 lg:mt-2">
            {role && <p className="mt-0.5 line-clamp-3 text-caption text-fg-2 lg:mt-0">{role}</p>}
            {c.context.map((line) => (
              <CandidateContextLine key={line.kind} line={line} />
            ))}
          </div>
        )}
      </div>

      {c.note && (
        <button
          type="button"
          title="Edit note"
          aria-describedby={nameId}
          onClick={() => onEditNote(c)}
          className="flex w-full items-start gap-2 border-t border-divider bg-surface-2 px-4 py-2 text-left transition-colors hover:bg-hover focus-visible:-outline-offset-2 md:px-3"
        >
          <Icon icon={StickyNote} size={12} className="mt-0.5 text-fg-2" />
          <span className="min-w-0 whitespace-pre-line break-words text-caption text-fg-1">
            <span className="sr-only">Edit note: </span>
            {c.note}
          </span>
        </button>
      )}

      <div className="flex items-center justify-between gap-1 border-t border-divider px-2 py-1 md:px-1">
        {next ? (
          <Button variant="ghost" iconRight={ArrowRight} aria-describedby={nameId} className="gap-1 md:px-2" onClick={() => onMove(c, next)}>
            Move to {STAGE_LABEL[next]}
          </Button>
        ) : (
          <Button variant="ghost" icon={c.note ? Pencil : StickyNote} aria-describedby={nameId} className="gap-1 md:px-2" onClick={() => onEditNote(c)}>
            {noteLabel}
          </Button>
        )}
        <Menu
          trigger={<Icon icon={Ellipsis} size={16} />}
          triggerLabel={`More actions for ${fullName}`}
          tooltip
          triggerClassName={buttonClasses({ variant: "ghost", iconOnly: true })}
          label={`Actions for ${fullName}`}
          minWidth={224}
          sheetOnPhone
        >
          <MenuGroup label="Move to">
            {PIPELINE_STAGES.map((s) => (
              <MenuRadioItem key={s} checked={s === c.stage} onClick={() => s !== c.stage && onMove(c, s)}>
                {STAGE_LABEL[s]}
              </MenuRadioItem>
            ))}
          </MenuGroup>
          <MenuDivider />
          <MenuItem icon={c.note ? Pencil : StickyNote} onClick={() => onEditNote(c)}>
            {noteLabel}
          </MenuItem>
          <MenuLink href={`/in/${slug}`} icon={UserRound}>
            View profile
          </MenuLink>
          <MenuDivider />
          <MenuItem icon={Trash2} destructive onClick={() => onRemove(c)}>
            Remove from pipeline
          </MenuItem>
        </Menu>
      </div>
    </article>
  );
}
