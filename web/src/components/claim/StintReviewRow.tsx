"use client";
import { forwardRef } from "react";
import { CircleAlert, Info } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { SourceDisclosure } from "@/components/data/SourceDisclosure";
import { LedgerRange } from "@/components/profile/LedgerRange";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { Textarea } from "@/components/ui/Textarea";
import type { ClaimStint } from "@/lib/queries/claim";
import { ReviewToggle, type Review } from "./ReviewToggle";

type StintReviewRowProps = {
  stint: ClaimStint;
  /** "Ian Falconer bio", appended to the source domain in the Source link. */
  sourceDetail: string;
  /** A fictional demo person: the row carries a dashed Demo chip (§6.4). */
  isDemo: boolean;
  review: Review | null;
  note: string;
  onReview: (value: Review) => void;
  onNote: (value: string) => void;
  /**
   * After Continue, for an unreviewed stint: "error" on the first one (danger ring, message, focus
   * goes there), "pending" on the rest (a neutral "Not reviewed yet" caption), so a long career
   * doesn't fill the page with red.
   */
  reviewState?: "error" | "pending" | null;
  noteError?: string | null;
};

/** A year in the evidence, bare or in parentheses ("(1987)"): the words a year is most often inferred from. */
const YEAR = /\(?\b(?:19|20)\d{2}\b\)?/;
/** Otherwise, words that explain a span ("two seasons", "since"). */
const CUE = /\b(?:seasons?|years?|since)\b/i;

const clean = (evidence: string) => evidence.trim().replace(/^["“]|["”]$/g, "").replace(/[\s.]+$/, "");

/** Where in the evidence the years come from: a year first, then a span word. Null when it has neither. */
function cueIn(text: string): { start: number; end: number } | null {
  const m = YEAR.exec(text) ?? CUE.exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

/**
 * A short verbatim excerpt of the evidence centred on the words the years were inferred from ("…on
 * state championship teams at Ann Arbor Pioneer in Michigan (1987)"), so the visible hint can quote
 * the phrase (§6.2) without repeating the whole sentence the Source disclosure already shows.
 */
function excerpt(text: string, cue: { start: number; end: number }, max = 72): string {
  if (text.length <= max) return text;
  // The clause holding the cue, then a word-aligned window inside it, centred on the cue.
  const from = Math.max(text.lastIndexOf(",", cue.start), text.lastIndexOf(";", cue.start)) + 1;
  const stops = [text.indexOf(",", cue.end), text.indexOf(";", cue.end)].filter((i) => i >= 0);
  const to = stops.length ? Math.min(...stops) : text.length;
  let start = from;
  let end = to;
  if (end - start > max) {
    const mid = Math.round((cue.start + cue.end) / 2);
    end = Math.min(to, Math.max(from, mid - max / 2) + max);
    start = Math.max(from, end - max);
    if (start > from) {
      const space = text.indexOf(" ", start);
      if (space >= 0 && space < cue.start) start = space + 1;
    }
    if (end < to) {
      const space = text.lastIndexOf(" ", end);
      if (space >= cue.end) end = space;
    }
  }
  const body = text.slice(start, end).trim().replace(/[,;:]$/, "");
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

/** The hint under the program line: why to look twice at this stint's years. */
function yearsHint(s: ClaimStint): string | null {
  if (s.inferred) {
    const text = s.evidence ? clean(s.evidence) : "";
    if (!text) return "Confirm these years: inferred from the staff bio, not stated in it.";
    const cue = cueIn(text);
    // Quote only a phrase that holds a year or a span; never imply a sentence states a year it doesn't.
    return cue ? `Confirm these years: inferred from “${excerpt(text, cue)}”` : "Confirm these years: inferred from the staff bio; the sentence under Source gives no year.";
  }
  if (s.startYear && (s.isCurrent || s.endYear)) return null;
  // The range already says what's missing ("End year not in source"); the hint says what to do.
  if (s.startYear || s.endYear || s.isCurrent) return "Add the missing year with Needs a fix, if you like.";
  return "Add the years with Needs a fix, if you like.";
}

/**
 * One stint in "Review your career" (§8.11 step 2): tile 32, title, program and chips, the hint
 * (for inferred years it quotes the source, so touch users get the reason too) and the Source
 * disclosure on the left; on the right, the range in the profile ledger's words and Correct · Needs
 * a fix under it, so the verdicts read down one column. Phone: one column, toggle full width.
 * Needs a fix opens an inline note. The ref points at the radio group (for focusing a skipped stint).
 */
export const StintReviewRow = forwardRef<HTMLDivElement, StintReviewRowProps>(function StintReviewRow(
  { stint, sourceDetail, isDemo, review, note, onReview, onNote, reviewState, noteError },
  ref,
) {
  const { org } = stint;
  const captionId = `stint-${stint.id}-review-caption`;
  const range = <LedgerRange text={stint.range} inferred={stint.inferred} reason={stint.inferredReason} />;
  const hint = yearsHint(stint);

  return (
    <li className="flex gap-3 py-4 first:pt-3 last:pb-1">
      <OrgMark shortName={org.shortName} name={org.name} size={32} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="md:flex md:items-start md:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-body font-medium">{stint.role}</p>
            <div className="md:hidden">{range}</div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-small text-fg-2">
              <span>{org.name}</span>
              <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} />
              {isDemo && <SampleChip label="Demo" />}
            </p>
            {hint && (
              <p className="mt-1 flex items-start gap-1 text-caption text-fg-3">
                <Icon icon={Info} size={12} className="mt-0.5 text-fg-2" />
                <span className="min-w-0 break-words">{hint}</span>
              </p>
            )}
            <SourceDisclosure evidence={stint.evidence} sourceUrl={stint.sourceUrl} sourceDetail={sourceDetail} className="mt-1" />
          </div>

          <div className="mt-2.5 md:mt-0 md:flex md:shrink-0 md:flex-col md:items-end">
            <div className="max-md:hidden">{range}</div>
            <ReviewToggle
              ref={ref}
              value={review}
              onChange={onReview}
              label={`Review ${stint.role} at ${org.shortName}`}
              invalid={reviewState === "error"}
              describedBy={reviewState ? captionId : undefined}
              className="md:mt-2"
            />
            {reviewState === "error" ? (
              <p id={captionId} className="mt-1.5 flex items-start gap-1 text-caption text-danger md:justify-end">
                <Icon icon={CircleAlert} size={12} className="mt-0.5" />
                Choose Correct or Needs a fix.
              </p>
            ) : reviewState === "pending" ? (
              <p id={captionId} className="mt-1.5 text-caption text-fg-3 md:text-right">
                Not reviewed yet
              </p>
            ) : null}
          </div>
        </div>

        {review === "fix" && (
          <Textarea
            id={`stint-${stint.id}-note`}
            label="What needs fixing?"
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="For example: the title was Offensive Line Coach, and the years were 2011–2019."
            help="Say what's wrong and what's right. Nothing on the profile changes until it's reviewed."
            error={noteError}
            maxLength={600}
            fieldClassName="mt-3"
          />
        )}
      </div>
    </li>
  );
});
