"use client";
import { forwardRef } from "react";
import { CircleAlert, Info } from "lucide-react";
import { ProgramBadges } from "@/components/data/Badges";
import { SeasonRange } from "@/components/data/SeasonRange";
import { SourceDisclosure } from "@/components/data/SourceDisclosure";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { Textarea } from "@/components/ui/Textarea";
import type { ClaimStint } from "@/lib/queries/claim";
import { ReviewToggle, type Review } from "./ReviewToggle";

type StintReviewRowProps = {
  stint: ClaimStint;
  /** "Ian Falconer bio", appended to the source domain in the Source link. */
  sourceDetail: string;
  review: Review | null;
  note: string;
  onReview: (value: Review) => void;
  onNote: (value: string) => void;
  /** Shown after Continue when the stint was skipped. */
  reviewError?: string | null;
  noteError?: string | null;
};

/**
 * One stint in "Review your career" (§8.11 step 2): tile 32, title, program and chips, the season
 * range (dotted when inferred, with "Confirm these years"), the Source disclosure, then Correct ·
 * Needs a fix. Needs a fix opens an inline note. The ref points at the radio group (for focusing the
 * first skipped stint).
 */
export const StintReviewRow = forwardRef<HTMLDivElement, StintReviewRowProps>(function StintReviewRow(
  { stint, sourceDetail, review, note, onReview, onNote, reviewError, noteError },
  ref,
) {
  const { org } = stint;
  const titleId = `stint-${stint.id}-title`;
  const errorId = `stint-${stint.id}-review-error`;
  const dated = !!stint.startYear;
  const inferred = !stint.yearsExplicit && dated;
  const range = <SeasonRange startYear={stint.startYear} endYear={stint.endYear} isCurrent={stint.isCurrent} inferred={inferred} variant="ledger" />;
  const hint = inferred
    ? "Confirm these years: they're inferred from the bio, not stated in it."
    : dated
      ? null
      : stint.endYear
        ? `The source gives only the last season, ${stint.endYear}. Add the rest in a note if you like.`
        : stint.isCurrent
          ? "Current role. The source gives no start year. Add it in a note if you like."
          : "The source gives no years. Add them in a note if you like.";

  return (
    <li className="flex gap-3 py-4 first:pt-3 last:pb-1">
      <OrgMark shortName={org.shortName} name={org.name} size={32} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="md:flex md:items-start md:gap-4">
          <div className="min-w-0 flex-1">
            <p id={titleId} className="text-body font-medium">
              {stint.role}
            </p>
            <div className="md:hidden">{range}</div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-small text-fg-2">
              <span>{org.name}</span>
              <ProgramBadges level={org.level} conferenceAbbr={org.conferenceAbbr} conference={org.conference} />
            </p>
          </div>
          <div className="max-md:hidden">{range}</div>
        </div>

        {hint && (
          <p className="mt-1 flex items-start gap-1 text-caption text-fg-3">
            <Icon icon={Info} size={12} className="mt-0.5 text-fg-2" />
            {hint}
          </p>
        )}

        <SourceDisclosure evidence={stint.evidence} sourceUrl={stint.sourceUrl} sourceDetail={sourceDetail} className="mt-1" />

        <div className="mt-2.5">
          <ReviewToggle
            ref={ref}
            value={review}
            onChange={onReview}
            label={`Review ${stint.role} at ${org.shortName}`}
            invalid={!!reviewError}
            describedBy={reviewError ? errorId : undefined}
          />
          {reviewError && (
            <p id={errorId} className="mt-1.5 flex items-start gap-1 text-caption text-danger">
              <Icon icon={CircleAlert} size={12} className="mt-0.5" />
              {reviewError}
            </p>
          )}
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
