"use client";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_AFTER = 30;

type IdentityStepProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Set once the code was accepted (coming back from step 2). */
  verifiedEmail: string | null;
  onVerified: (email: string) => void;
  onContinue: () => void;
  onReset: () => void;
};

function resendLabel(s: number) {
  return `0:${String(s).padStart(2, "0")}`;
}

/**
 * Step 1, Confirm identity (§8.11): school email + primary "Send code", then a 6-digit code
 * (numeric, one-time-code autocomplete) with "Resend code" after 30 s. Stubbed: no email is sent
 * and any six digits work; at each field a dashed Demo chip and a 12px caption say so.
 */
export function IdentityStep({ headingRef, verifiedEmail, onVerified, onContinue, onReset }: IdentityStepProps) {
  const [email, setEmail] = useState(verifiedEmail ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [announce, setAnnounce] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  function send(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return fail("Enter your school email.");
    if (!EMAIL_RE.test(value)) return fail("Enter an email address like name@school.edu.");
    setEmailError(null);
    setSentTo(value.toLowerCase());
    setCode("");
    setCodeError(null);
    setResendIn(RESEND_AFTER);
    setAnnounce(`Code sent to ${value.toLowerCase()}.`);
    window.requestAnimationFrame(() => codeRef.current?.focus());
  }

  function fail(message: string) {
    setEmailError(message);
    emailRef.current?.focus();
  }

  function verify(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setCodeError("Enter the 6 digits from the email.");
      codeRef.current?.focus();
      return;
    }
    onVerified(sentTo!);
  }

  function resend() {
    setResendIn(RESEND_AFTER);
    setCode("");
    setCodeError(null);
    setAnnounce(`We sent a new code to ${sentTo}.`);
    codeRef.current?.focus();
  }

  function changeEmail() {
    setSentTo(null);
    setCode("");
    setCodeError(null);
    setAnnounce("");
    window.requestAnimationFrame(() => emailRef.current?.focus());
  }

  return (
    <Card padding="main" aria-labelledby="claim-step-title">
      <h2 id="claim-step-title" ref={headingRef} tabIndex={-1} className="text-title outline-none">
        Confirm it&apos;s you
      </h2>
      <p className="mt-1 max-w-prose text-small text-fg-2">
        Claiming lets you correct your career record, write your own About and choose who sees that you&apos;re open to opportunities. First, confirm it&apos;s
        you with your school email.
      </p>

      {verifiedEmail ? (
        <div className="mt-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
            <Icon icon={Check} size={16} className="text-fg-1" />
            <span className="font-medium">Email confirmed</span>
            <span className="min-w-0 break-words text-fg-2">{verifiedEmail}</span>
          </p>
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
            <Button variant="primary" onClick={onContinue} className="max-md:w-full">
              Continue
            </Button>
            <Button variant="ghost" onClick={onReset} className="max-md:w-full">
              Use a different email
            </Button>
          </div>
        </div>
      ) : !sentTo ? (
        <form noValidate onSubmit={send} className="mt-4">
          <Input
            ref={emailRef}
            id="claim-email"
            type="email"
            label="School email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            placeholder="name@school.edu"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            help="Use the address your program gave you, like the one on its staff directory."
            error={emailError}
            required
            fieldClassName="max-w-[400px]"
          />
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <Button type="submit" variant="primary" icon={Mail} className="max-md:w-full">
              Send code
            </Button>
            <p className="flex items-center gap-1.5 text-caption text-fg-3">
              <SampleChip label="Demo" />
              No email is sent.
            </p>
          </div>
        </form>
      ) : (
        <form noValidate onSubmit={verify} className="mt-4">
          <p className="text-small text-fg-1">
            We sent a 6-digit code to <span className="break-words font-medium">{sentTo}</span>.{" "}
            <button
              type="button"
              onClick={changeEmail}
              className="target-24 relative font-medium text-link underline-offset-2 hover:underline max-md:before:absolute max-md:before:-inset-x-1 max-md:before:-inset-y-2.5"
            >
              Change email
            </button>
          </p>
          <Input
            ref={codeRef}
            id="claim-code"
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              if (codeError) setCodeError(null);
            }}
            error={codeError}
            required
            className="num tracking-[.2em]"
            fieldClassName="mt-4 max-w-[200px]"
          />
          <p className="mt-2 flex items-center gap-1.5 text-caption text-fg-3">
            <SampleChip label="Demo" />
            Any 6 digits work.
          </p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <Button type="submit" variant="primary" className="max-md:w-full">
              Verify
            </Button>
            {resendIn > 0 ? (
              <p className="num text-small text-fg-3 max-md:flex max-md:min-h-11 max-md:items-center max-md:justify-center">Resend code in {resendLabel(resendIn)}</p>
            ) : (
              <button
                type="button"
                onClick={resend}
                className="target-24 self-center rounded-xs text-small font-medium text-link underline-offset-2 hover:underline max-md:my-0 max-md:min-h-11 max-md:px-3 md:self-auto"
              >
                Resend code
              </button>
            )}
          </div>
        </form>
      )}
      <p role="status" className="sr-only">
        {announce}
      </p>
    </Card>
  );
}
