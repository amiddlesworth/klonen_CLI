"use client";
import type { RefObject } from "react";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { InferredKey } from "@/components/data/InferredYear";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import type { ClaimStint, ClaimSubject } from "@/lib/queries/claim";
import type { ClaimMode } from "./ClaimFlow";
import { ProfilePreview } from "./ProfilePreview";
import type { Review } from "./ReviewToggle";

type PublishStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  subject: ClaimSubject;
  email: string;
  reviews: Record<number, Review>;
  notes: Record<number, string>;
  missing: string;
  publishing: boolean;
  /** Only "own" (the coach demo on its own profile) records the claim. */
  mode: ClaimMode;
  error: string | null;
  onBack: () => void;
  onPublish: () => void;
};

/**
 * Step 3, Publish (§8.11): the header as it will appear (no banner, no Unclaimed chip), a summary of
 * the review, the demo boundary in plain words, then primary "Publish profile" and secondary Back.
 */
export function PublishStep({ headingRef, subject, email, reviews, notes, missing, publishing, mode, error, onBack, onPublish }: PublishStepProps) {
  const fixes: ClaimStint[] = subject.stints.filter((s) => reviews[s.id] === "fix");
  const correct = subject.stints.length - fixes.length;
  const first = subject.person.firstName ?? subject.person.fullName.split(" ")[0];

  return (
    <Card padding="main" aria-labelledby="claim-step-title">
      <h2 id="claim-step-title" ref={headingRef} tabIndex={-1} className="text-title outline-none">
        Publish your profile
      </h2>
      <p className="mt-1 max-w-prose text-small text-fg-2">
        Here&apos;s the top of the profile once it&apos;s claimed, with no Unclaimed label and no banner about public sources.
      </p>

      <div className="-mx-4 mt-4 border-y border-divider bg-surface-2 px-4 pb-1 pt-4 md:-mx-6 md:px-6">
        <p className="mb-3 text-caption font-medium text-fg-3">Preview</p>
        <ProfilePreview subject={subject} />
        {/* Explains the dotted First season (§6.2): tooltips don't exist on touch, and the step 2 legend is gone.
            Phone hides First season, as the profile does, so the legend goes with it. */}
        {subject.stats.firstSeason?.inferred && (
          <p className="border-t border-divider py-2.5 text-caption text-fg-3 max-md:hidden">
            {/* The sample is the dotted First season itself (audit C03). */}
            <InferredKey year={subject.stats.firstSeason.year} />
          </p>
        )}
      </div>

      <dl className="mt-1 divide-y divide-divider text-small">
        <div className="grid gap-x-4 gap-y-0.5 py-3 md:grid-cols-[160px_1fr]">
          <dt className="text-fg-2">School email</dt>
          <dd className="break-words font-medium">{email}</dd>
        </div>
        <div className="grid gap-x-4 gap-y-0.5 py-3 md:grid-cols-[160px_1fr]">
          <dt className="text-fg-2">Career review</dt>
          <dd>
            <span className="num font-medium">
              {correct} correct
              {fixes.length > 0 && ` · ${fixes.length} ${fixes.length === 1 ? "needs" : "need"} a fix`}
            </span>
            {fixes.length > 0 && (
              <ul className="mt-2 space-y-2">
                {fixes.map((s) => (
                  <li key={s.id} className="border-l-2 border-border-strong pl-3">
                    <span className="block font-medium">
                      {s.role} · {s.org.shortName}
                    </span>
                    <span className="block whitespace-pre-line break-words text-fg-2">{notes[s.id]?.trim()}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        {missing.trim() && (
          <div className="grid gap-x-4 gap-y-0.5 py-3 md:grid-cols-[160px_1fr]">
            <dt className="text-fg-2">Missing roles</dt>
            <dd className="whitespace-pre-line break-words">{missing.trim()}</dd>
          </div>
        )}
      </dl>

      <div role="note" className="mt-1 flex items-start gap-2 border-t border-divider pt-3 text-small text-fg-2">
        <SampleChip label="Demo" className="mt-px" />
        <p className="min-w-0">
          In the live product, Publish makes this profile yours: the Unclaimed label and source banner come off and you can edit everything.{" "}
          {mode === "own"
            ? "In this demo it only records your claim."
            : mode === "other"
              ? "In this demo nothing is saved when you walk through someone else's profile."
              : "In this demo nothing is saved for visitors."}{" "}
          {first}&apos;s public profile and records stay exactly as they are, and correction notes aren&apos;t saved.
        </p>
      </div>

      <CardFooter className="mt-4 flex flex-col gap-3 pt-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-small text-danger">
              <Icon icon={CircleAlert} size={16} className="mt-0.5" />
              {error}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Button onClick={onBack} disabled={publishing}>
            Back
          </Button>
          <Button variant="primary" icon={ShieldCheck} loading={publishing} onClick={onPublish}>
            Publish profile
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
