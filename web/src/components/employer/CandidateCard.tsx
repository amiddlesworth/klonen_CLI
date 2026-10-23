"use client";
import Link from "next/link";
import { useId } from "react";
import { ArrowRight, Building2, Ellipsis, Flag, Network, Pencil, StickyNote, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuDivider, MenuGroup, MenuItem, MenuLink, MenuRadioItem } from "@/components/ui/MenuItems";
import { cn } from "@/lib/cn";
import type { Candidate, CandidateContext } from "@/lib/queries/employer";
import { nextStage, PIPELINE_STAGES, STAGE_LABEL, type PipelineStage } from "./stages";

/**
 * Footer buttons: compact padding; in the narrowest four-column board (1081–1279px) their icons
 * drop so "Add note" and "Move to {stage}" stay on one line. The labels never change.
 */
const FOOTER_BUTTON = "gap-1 md:px-2 lg:max-xl:[&>svg]:hidden";

const CONTEXT_ICON: Record<CandidateContext["kind"], LucideIcon> = { tree: Network, previous: Building2, played: Flag };

type CandidateCardProps = {
  candidate: Candidate;
  onMove: (candidate: Candidate, stage: PipelineStage) => void;
  onRemove: (candidate: Candidate) => void;
  onEditNote: (candidate: Candidate) => void;
};

/** "{Title} at {Program}", or whichever half is known. */
function roleLine(c: Candidate): string | null {
  const { org } = c.person;
  // A break opportunity after each slash, so "Coordinator/Offensive Line" wraps at the slash.
  const title = c.person.currentTitle?.replace(/\//g, "/\u200B") ?? null;
  if (title && org) return `${title} at ${org.shortName}`;
  return title ?? org?.shortName ?? null;
}

/**
 * Candidate card (§8.14): avatar 32, name 13/600 (links to the profile), title at program 12
 * --fg-2, context lines (tree, previous stop), the note on a --surface-2 band, and a footer with
 * Add note and the next stage. The More menu holds every move ("Move to"), the note, the profile
 * link and Remove: the keyboard and touch alternative to dragging.
 */
export function CandidateCard({ candidate: c, onMove, onRemove, onEditNote }: CandidateCardProps) {
  const nameId = useId();
  const next = nextStage(c.stage);
  const { fullName, slug, isDemo } = c.person;
  const role = roleLine(c);
  const noteLabel = c.note ? "Edit note" : "Add note";

  return (
    <article
      id={`candidate-${c.entryId}`}
      tabIndex={-1}
      aria-labelledby={nameId}
      className="relative min-w-0 border-y border-border bg-surface outline-offset-2 md:rounded-md md:border"
    >
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5 md:px-3 md:pt-3">
        <Avatar name={fullName} tintKey={slug} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-9 md:pr-6">
            {/* In the narrow lg columns the Demo chip always takes its own line, so cards stay alike. */}
            <h3 id={nameId} className="min-w-0 break-words text-small font-semibold lg:basis-full">
              <Link href={`/in/${slug}`} className="target-24 inline-block underline-offset-2 hover:underline">
                {fullName}
              </Link>
            </h3>
            {isDemo && <SampleChip />}
          </div>
          {role && <p className="line-clamp-3 pr-9 text-caption text-fg-2 md:pr-6">{role}</p>}
          {c.context.map((line) => (
            <ContextLine key={line.kind} icon={CONTEXT_ICON[line.kind]} className="mt-1">
              {line.text}
              {line.years && (
                <>
                  {", "}
                  <span aria-hidden="true" className="num">
                    {line.years}
                  </span>
                  <span className="sr-only">{line.yearsLabel}</span>
                </>
              )}
            </ContextLine>
          ))}
        </div>
        <Menu
          trigger={<Icon icon={Ellipsis} size={16} />}
          triggerLabel={`More actions for ${fullName}`}
          tooltip
          triggerClassName={cn(buttonClasses({ variant: "ghost", size: "sm", iconOnly: true }), "absolute right-2 top-2.5 md:right-1.5 md:top-2")}
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

      {c.note && (
        <div className="flex items-start gap-2 border-t border-divider bg-surface-2 px-4 py-2 md:px-3">
          <Icon icon={StickyNote} size={12} className="mt-0.5 text-fg-2" />
          <p className="min-w-0 whitespace-pre-line break-words text-caption text-fg-1">
            <span className="sr-only">Note: </span>
            {c.note}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-divider px-2 py-1 md:px-1">
        <Button variant="ghost" size="sm" icon={c.note ? Pencil : StickyNote} aria-describedby={nameId} className={FOOTER_BUTTON} onClick={() => onEditNote(c)}>
          {noteLabel}
        </Button>
        {next && (
          <Button variant="ghost" size="sm" iconRight={ArrowRight} aria-describedby={nameId} className={FOOTER_BUTTON} onClick={() => onMove(c, next)}>
            Move to {STAGE_LABEL[next]}
          </Button>
        )}
      </div>
    </article>
  );
}
