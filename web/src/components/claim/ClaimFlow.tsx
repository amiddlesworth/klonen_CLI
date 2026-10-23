"use client";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Info, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { submitClaim } from "@/lib/actions/claim";
import type { ClaimSubject } from "@/lib/queries/claim";
import { ClaimStepper, CLAIM_STEPS } from "./ClaimStepper";
import { IdentityStep } from "./IdentityStep";
import { PublishStep } from "./PublishStep";
import { ReviewStep } from "./ReviewStep";
import type { Review } from "./ReviewToggle";

type ClaimFlowProps = {
  subject: ClaimSubject;
  /** Server-rendered identity block (h1, avatar, name, Unclaimed chip) for the header card. */
  identity: ReactNode;
  /** The same block once the claim is recorded: a dashed Demo chip in place of Unclaimed. */
  identityDone: ReactNode;
  /** Shown under the stepper, e.g. when the coach demo opens someone else's claim. */
  notice?: ReactNode;
  /** False for signed-out visitors: their walk-through isn't saved. */
  saves: boolean;
};

/**
 * Claim flow (§8.11): header card with the stepper, then one card per step. Step state lives here
 * (a reload starts over). Publishing calls submitClaim, which records the claim (coach demo only)
 * and changes nothing on the public profile. The success card is the confirmation and takes focus;
 * there is no toast repeating it, and no redirect (the public profile wouldn't show the claim).
 */
export function ClaimFlow({ subject, identity, identityDone, notice, saves }: ClaimFlowProps) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [missing, setMissing] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recorded: boolean } | null>(null);
  const [publishing, startPublish] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const { person } = subject;
  const first = person.firstName ?? person.fullName.split(" ")[0];
  const done = result !== null;

  // Each step change starts at the top with focus on the new step's heading.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, done]);

  function go(next: number) {
    setError(null);
    setStep(next);
  }

  function publish() {
    if (!email) return go(0);
    setError(null);
    startPublish(async () => {
      const fixes = subject.stints.filter((s) => reviews[s.id] === "fix").length;
      const res = await submitClaim({ slug: person.slug, email, confirmed: subject.stints.length - fixes, flagged: fixes }).catch(() => null);
      if (!res) return setError("We couldn't reach the server. Try again.");
      if (!res.ok) return setError(res.error);
      setResult({ recorded: res.recorded });
    });
  }

  return (
    <>
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 md:px-6 md:pb-4 md:pt-5">{done ? identityDone : identity}</div>
        <div className="border-t border-divider px-4 py-3 md:px-6 md:py-4">
          <ClaimStepper current={done ? CLAIM_STEPS.length : step} />
        </div>
        {notice && (
          <div role="note" className="flex items-start gap-2 border-t border-divider bg-surface-2 px-4 py-3 text-small text-fg-2 md:px-6">
            <Icon icon={Info} size={16} className="mt-0.5" />
            <div className="min-w-0">{notice}</div>
          </div>
        )}
      </Card>

      {result ? (
        <Card padding="main" aria-labelledby="claim-step-title">
          <div className="flex items-center gap-2">
            <Icon icon={ShieldCheck} size={20} className="text-fg-2" />
            <h2 id="claim-step-title" ref={headingRef} tabIndex={-1} className="text-title outline-none">
              {result.recorded ? "Claim recorded" : "Claim complete"}
            </h2>
          </div>
          <p className="mt-2 max-w-prose text-body">
            {result.recorded ? (
              <>
                Your claim to {person.fullName}&apos;s profile is recorded with <span className="break-words font-medium">{email}</span>.
              </>
            ) : (
              <>
                You confirmed <span className="break-words font-medium">{email}</span> and reviewed {person.fullName}&apos;s career. Visitors&apos; claims
                aren&apos;t saved in this demo.
              </>
            )}
          </p>
          <h3 className="mt-4 text-small font-semibold">In the live product</h3>
          <p className="mt-0.5 max-w-prose text-small text-fg-2">
            This is when the profile goes live as claimed: the Unclaimed label and the banner about public sources come off, your corrections go to review,
            and you can write your own About and turn on Open to opportunities.
          </p>
          <div role="note" className="-mx-4 mt-4 flex items-start gap-2 border-y border-divider bg-surface-2 px-4 py-3 text-small text-fg-2 md:-mx-6 md:px-6">
            <SampleChip label="Demo" className="mt-px" />
            <p className="min-w-0">
              Nothing on the public page changed. {first}&apos;s profile still shows the record built from public sources, exactly as before.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <ButtonLink href={`/in/${person.slug}`} className="max-md:w-full">
              View public profile
            </ButtonLink>
          </div>
        </Card>
      ) : step === 0 ? (
        <IdentityStep
          headingRef={headingRef}
          verifiedEmail={email}
          onVerified={(v) => {
            setEmail(v);
            go(1);
          }}
          onContinue={() => go(1)}
          onReset={() => setEmail(null)}
        />
      ) : step === 1 ? (
        <ReviewStep
          headingRef={headingRef}
          stints={subject.stints}
          isDemo={person.isDemo}
          sourceDetail={`${person.fullName} bio`}
          reviews={reviews}
          notes={notes}
          missing={missing}
          onReview={(id, v) => setReviews((r) => ({ ...r, [id]: v }))}
          onNote={(id, v) => setNotes((n) => ({ ...n, [id]: v }))}
          onMarkRestCorrect={() =>
            setReviews((r) => {
              const next = { ...r };
              for (const s of subject.stints) next[s.id] ??= "correct";
              return next;
            })
          }
          onMissing={setMissing}
          onBack={() => go(0)}
          onContinue={() => go(2)}
        />
      ) : (
        <PublishStep
          headingRef={headingRef}
          subject={subject}
          email={email ?? ""}
          reviews={reviews}
          notes={notes}
          missing={missing}
          publishing={publishing}
          saves={saves}
          error={error}
          onBack={() => go(1)}
          onPublish={publish}
        />
      )}
    </>
  );
}
