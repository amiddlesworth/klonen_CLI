"use client";
import { useRef, useState, type RefObject } from "react";
import { CircleAlert, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import type { ClaimStint } from "@/lib/queries/claim";
import type { Review } from "./ReviewToggle";
import { StintReviewRow } from "./StintReviewRow";

type ReviewStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  stints: ClaimStint[];
  sourceDetail: string;
  reviews: Record<number, Review>;
  notes: Record<number, string>;
  missing: string;
  onReview: (id: number, value: Review) => void;
  onNote: (id: number, value: string) => void;
  onMarkRestCorrect: () => void;
  onMissing: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Step 2, Review your career (§8.11): every stint with Correct · Needs a fix and an inline note.
 * Continue checks that every stint was reviewed and every fix has a note, then moves focus to the
 * first one that wasn't.
 */
export function ReviewStep(props: ReviewStepProps) {
  const { headingRef, stints, sourceDetail, reviews, notes, missing, onReview, onNote, onMarkRestCorrect, onMissing, onBack, onContinue } = props;
  const [checked, setChecked] = useState(false);
  const toggles = useRef(new Map<number, HTMLDivElement | null>());

  const coaching = stints.filter((s) => !s.asPlayer);
  const playing = stints.filter((s) => s.asPlayer);
  const reviewed = stints.filter((s) => reviews[s.id]).length;
  const unreviewed = stints.length - reviewed;
  const hasInferred = stints.some((s) => !s.yearsExplicit && s.startYear);

  function missingNote(s: ClaimStint) {
    return reviews[s.id] === "fix" && !notes[s.id]?.trim();
  }
  const notesMissing = stints.filter(missingNote).length;
  // Shown after the first Continue, and kept current as the coach fixes things.
  const summary = !checked
    ? null
    : unreviewed > 0
      ? `Review ${plural(unreviewed, "more role", "more roles")} to continue.`
      : notesMissing > 0
        ? `Add a note to ${notesMissing === 1 ? "the role that needs" : `the ${notesMissing} roles that need`} a fix.`
        : null;

  function next() {
    setChecked(true);
    const skipped = stints.find((s) => !reviews[s.id]);
    if (skipped) {
      toggles.current.get(skipped.id)?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus();
      return;
    }
    const noNote = stints.find(missingNote);
    if (noNote) {
      document.getElementById(`stint-${noNote.id}-note`)?.focus();
      return;
    }
    onContinue();
  }

  const renderRows = (list: ClaimStint[]) => (
    <ul className="divide-y divide-divider">
      {list.map((s) => (
        <StintReviewRow
          key={s.id}
          ref={(el) => {
            toggles.current.set(s.id, el);
          }}
          stint={s}
          sourceDetail={sourceDetail}
          review={reviews[s.id] ?? null}
          note={notes[s.id] ?? ""}
          onReview={(v) => onReview(s.id, v)}
          onNote={(v) => onNote(s.id, v)}
          reviewError={checked && !reviews[s.id] ? "Choose Correct or Needs a fix." : null}
          noteError={checked && missingNote(s) ? "Say what needs fixing." : null}
        />
      ))}
    </ul>
  );

  return (
    <Card padding="main" aria-labelledby="claim-step-title">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 id="claim-step-title" ref={headingRef} tabIndex={-1} className="grow text-title outline-none">
          Review your career
        </h2>
        <span className="num text-small text-fg-3">{plural(stints.length, "role", "roles")}</span>
      </div>
      <p className="mt-1 max-w-prose text-small text-fg-2">
        This is what public sources say. Mark each role Correct, or Needs a fix and tell us what&apos;s wrong. Open Source to see the sentence each one came from.
      </p>

      {stints.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No roles in the source yet."
          description="Tell us about your career below. You can add each role yourself once the profile is published."
          spacing="md"
        />
      ) : (
        <>
          <div className="mt-4 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-divider pb-3">
            <p className="num text-small text-fg-2" aria-live="polite">
              <span className="font-semibold text-fg-1">{reviewed}</span> of {stints.length} reviewed
            </p>
            {unreviewed > 0 && stints.length > 1 && (
              <Button variant="ghost" size="sm" onClick={onMarkRestCorrect}>
                {reviewed === 0 ? "Mark all correct" : "Mark the rest correct"}
              </Button>
            )}
          </div>

          {coaching.length > 0 && (
            <section aria-labelledby="claim-coaching" className="mt-4">
              <h3 id="claim-coaching" className="text-small font-semibold">
                Coaching <span className="num font-normal text-fg-3">{coaching.length}</span>
              </h3>
              {renderRows(coaching)}
            </section>
          )}
          {playing.length > 0 && (
            <section aria-labelledby="claim-playing" className="mt-4 border-t border-divider pt-4">
              <h3 id="claim-playing" className="text-small font-semibold">
                Playing career <span className="num font-normal text-fg-3">{playing.length}</span>
              </h3>
              {renderRows(playing)}
            </section>
          )}
          {hasInferred && (
            <p className="mt-4 border-t border-divider pt-3 text-caption text-fg-3">
              <span className="inf num mr-1.5 text-fg-2">2004</span>
              Year inferred from the bio, not stated in it
            </p>
          )}
        </>
      )}

      <Textarea
        id="claim-missing"
        label={
          <>
            Anything missing? <span className="font-normal text-fg-3">(optional)</span>
          </>
        }
        value={missing}
        onChange={(e) => onMissing(e.target.value)}
        placeholder="For example: Linebackers Coach at Linfield, 2008–2009."
        help="List roles we don't have yet, with the program and years."
        maxLength={1000}
        fieldClassName="mt-5"
      />

      <CardFooter className="mt-5 flex flex-col gap-3 pt-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          {summary && (
            <p role="alert" className="flex items-start gap-1.5 text-small text-danger">
              <Icon icon={CircleAlert} size={16} className="mt-0.5" />
              {summary}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Button onClick={onBack}>Back</Button>
          <Button variant="primary" onClick={next}>
            Continue
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
