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

const CUE = /\b(?:seasons?|years?|since|from \d{4}|in \d{4})\b/i;

/**
 * A short verbatim excerpt of the evidence around the words the years were inferred from ("enters
 * his third season at Pacific University as…"), so the visible hint can quote the phrase (§6.2)
 * without repeating the whole sentence the Source disclosure already shows.
 */
function excerpt(evidence: string, max = 72): string {
  const text = evidence.trim().replace(/^["“]|["”]$/g, "").replace(/[\s.]+$/, "");
  if (text.length <= max) return text;
  const cue = CUE.exec(text)?.index ?? 0;
  // The clause holding the cue, then a word-aligned window inside it.
  const from = Math.max(text.lastIndexOf(",", cue), text.lastIndexOf(";", cue)) + 1;
  const stops = [text.indexOf(",", cue), text.indexOf(";", cue)].filter((i) => i >= 0);
  const to = stops.length ? Math.min(...stops) : text.length;
  let start = from;
  let end = to;
  if (end - start > max) {
    start = Math.max(from, cue - 28);
    end = Math.min(to, start + max);
    if (start > from) start = text.indexOf(" ", start) + 1 || start;
    if (end < to) end = text.lastIndexOf(" ", end) > start ? text.lastIndexOf(" ", end) : end;
  }
  const body = text.slice(start, end).trim().replace(/[,;:]$/, "");
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

/** The hint under the program line: why to look twice at this stint's years. */
function yearsHint(s: ClaimStint): string | null {
  if (s.inferred) {
    return s.evidence?.trim() ? `Confirm these years: inferred from “${excerpt(s.evidence)}”` : "Confirm these years: inferred from the bio, not stated in it.";
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
