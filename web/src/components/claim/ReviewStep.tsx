"use client";
import { useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { CircleAlert, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import type { ClaimStint } from "@/lib/queries/claim";
import type { Review } from "./ReviewToggle";
import { StintReviewRow } from "./StintReviewRow";

type ReviewStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  stints: ClaimStint[];
  /** A fictional demo person: the intro says the roles were invented, and each row has a Demo chip. */
  isDemo: boolean;
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
 * Capture aid (§10), kept here because html.capture-full is set only by BottomTabBar, which isn't
 * mounted for visitors. Under an automated browser (navigator.webdriver), unless the hash contains
 * "fold", the footer sits in place at the end of the card: full-page captures draw sticky elements
 * at their first-viewport position. Real users are unaffected.
 */
function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const captureSnapshot = () => navigator.webdriver === true && !location.hash.includes("fold");
const noCapture = () => false;

/** Bring an element to the middle of the viewport (clear of the sticky footer), then focus it. */
function reveal(el: HTMLElement | null | undefined) {
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.focus({ preventScroll: true });
}

/**
 * Step 2, Review your career (§8.11): every stint with Correct · Needs a fix and an inline note.
 * The footer is sticky at the bottom of the viewport (above the tab bar on phone when there is one;
 * visitors have none, so there it sits flush with the screen bottom), so the reviewed count, "Mark
 * the rest correct", Back and Continue stay in reach on a 20-role career. Continue
 * checks that every stint was reviewed and every fix has a note, then moves focus to the first one
 * that wasn't; only that row turns --danger, the other skipped rows get a neutral caption.
 */
export function ReviewStep(props: ReviewStepProps) {
  const { headingRef, stints, isDemo, sourceDetail, reviews, notes, missing, onReview, onNote, onMarkRestCorrect, onMissing, onBack, onContinue } = props;
  const [checked, setChecked] = useState(false);
  const captureFull = useSyncExternalStore(subscribeHash, captureSnapshot, noCapture);
  const toggles = useRef(new Map<number, HTMLDivElement | null>());

  const coaching = stints.filter((s) => !s.asPlayer);
  const playing = stints.filter((s) => s.asPlayer);
  const reviewed = stints.filter((s) => reviews[s.id]).length;
  const unreviewed = stints.length - reviewed;
  const firstSkipped = stints.find((s) => !reviews[s.id])?.id ?? null;
  const hasInferred = stints.some((s) => s.inferred && !s.range.undated);

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
    if (firstSkipped !== null) {
      const group = toggles.current.get(firstSkipped);
      group?.scrollIntoView({ block: "center" });
      group?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus({ preventScroll: true });
      return;
    }
    const noNote = stints.find(missingNote);
    if (noNote) {
      reveal(document.getElementById(`stint-${noNote.id}-note`));
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
          isDemo={isDemo}
          review={reviews[s.id] ?? null}
          note={notes[s.id] ?? ""}
          onReview={(v) => onReview(s.id, v)}
          onNote={(v) => onNote(s.id, v)}
          reviewState={!checked || reviews[s.id] ? null : s.id === firstSkipped ? "error" : "pending"}
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
        {isDemo
          ? "These roles were invented for the demo; this person isn't real. Mark each role Correct, or Needs a fix and say what's wrong."
          : "This is what public sources say. Mark each role Correct, or Needs a fix and tell us what's wrong. Open Source to see the sentence each one came from."}
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
          {coaching.length > 0 && (
            <section aria-labelledby="claim-coaching" className="mt-4 border-t border-divider pt-4">
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
              <span aria-hidden="true" className="inf num mr-1.5 cursor-default text-fg-2">
                2004
              </span>
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

      {/*
        Sticky footer: bleeds to the card edges and replaces the card's bottom padding. Phone: flush
        with the screen bottom (plus the safe area) for visitors; signed in, AppShell's .has-tabbar
        means the fixed tab bar is there, so it sits on top of the bar instead. Under the capture aid
        it is static at the end of the card.
      */}
      <div
        className={cn(
          "z-10 -mx-4 -mb-4 mt-5 border-t border-divider bg-surface px-4 py-3 md:-mx-6 md:-mb-5 md:rounded-b-md md:px-6",
          captureFull
            ? "static"
            : "sticky bottom-0 max-md:pb-[calc(12px+env(safe-area-inset-bottom))] max-md:[.has-tabbar_&]:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] max-md:[.has-tabbar_&]:pb-3",
        )}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-h-7 items-center justify-between gap-3">
              <p className="num text-small text-fg-2" aria-live="polite">
                <span className="font-semibold text-fg-1">{reviewed}</span> of {stints.length} reviewed
              </p>
              {unreviewed > 0 && stints.length > 1 && (
                <Button variant="ghost" size="sm" phone="none" onClick={onMarkRestCorrect} className="-mr-2.5 max-md:before:absolute max-md:before:-inset-y-2 max-md:before:-left-2 max-md:before:right-0 md:hidden">
                  {reviewed === 0 ? "Mark all correct" : "Mark the rest correct"}
                </Button>
              )}
            </div>
            {summary && (
              <p role="alert" className="mt-0.5 flex items-start gap-1.5 text-small text-danger">
                <Icon icon={CircleAlert} size={16} className="mt-px" />
                {summary}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
            {unreviewed > 0 && stints.length > 1 && (
              <Button variant="ghost" onClick={onMarkRestCorrect} className="max-md:hidden">
                {reviewed === 0 ? "Mark all correct" : "Mark the rest correct"}
              </Button>
            )}
            <Button onClick={onBack}>Back</Button>
            <Button variant="primary" onClick={next}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
