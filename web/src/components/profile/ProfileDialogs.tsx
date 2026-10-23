"use client";
import { useId, useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { useDemoSwitch } from "@/components/shell/DemoSwitcher";
import type { DemoAccountOption } from "@/components/shell/types";
import { Button } from "@/components/ui/Button";
import { SampleChip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { inviteToClaim, reportProfileError } from "@/lib/actions/profile";

export type ProfilePerson = { id: string; slug: string; fullName: string; firstName: string; claimed: boolean };

/** Why the invite sheet opened: the copy names the action that can't reach the coach yet. */
export type InviteReason = "connect" | "message" | "invite";

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void };

/**
 * "Invite {first} to claim" sheet (§8.4): on an unclaimed profile nobody can receive a connection
 * request or a message, so Connect and Message open this instead. Demo: the action records nothing
 * and the sheet confirms in place.
 */
export function InviteSheet({ person, reason, open, onOpenChange }: SheetProps & { person: ProfilePerson; reason: InviteReason }) {
  const noteId = useId();
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = person.firstName;

  const change = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setSent(false);
      setError(null);
    }
  };
  const send = () =>
    start(async () => {
      setError(null);
      const res = await inviteToClaim({ personId: person.id, note: note.trim() || undefined });
      if (res.ok) setSent(true);
      else setError(res.error);
    });

  const why =
    reason === "connect"
      ? `${first} hasn't claimed this profile yet, so a connection request can't reach ${first} here.`
      : reason === "message"
        ? `${first} hasn't claimed this profile yet, so a message can't reach ${first} here.`
        : `${first} hasn't claimed this profile yet.`;

  return (
    <Dialog
      open={open}
      onOpenChange={change}
      title={sent ? "Invite ready" : `Invite ${first} to claim this profile`}
      description={sent ? undefined : `${why} An invite asks ${first} to claim it, check each role and add an About.`}
      footer={(close) =>
        sent ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" icon={Send} loading={pending} onClick={send}>
              Send invite
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex items-start gap-3" role="status">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-hover text-fg-1">
            <Icon icon={Check} size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-body font-medium">Your invite to {first} is ready.</p>
            <p className="mt-1 text-small text-fg-2">
              This is a demo, so nothing was sent or recorded. Once {first} claims the profile, you can connect and message here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Textarea
            id={noteId}
            label="Add a note (optional)"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`Say how you know ${first}`}
            help="Shown with the invite."
          />
          <p className="flex flex-wrap items-center gap-2 text-caption text-fg-3">
            <SampleChip label="Demo" />
            Nothing is sent or recorded in the demo.
          </p>
          {error && <ErrorState message={error} />}
        </div>
      )}
    </Dialog>
  );
}

/**
 * Sign-in prompt for visitors (no demo session): the demo account choices from the Me menu's
 * switcher, as full-width options. Switching keeps the viewer on this profile.
 */
export function SignInSheet({ accounts, title, open, onOpenChange }: SheetProps & { accounts: DemoAccountOption[]; title: string }) {
  const { switchTo, pending } = useDemoSwitch();
  const labels: Record<string, string> = { coach: "Coach", employer: "Athletic director" };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Sign-in is a demo. Pick an account to explore as; you'll stay on this profile."
      footer={(close) => <Button onClick={close}>Cancel</Button>}
    >
      <ul className="flex flex-col gap-2">
        {accounts.map((a) => (
          <li key={a.role}>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                switchTo(a.role, a);
                onOpenChange(false);
              }}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm border border-control bg-surface px-3 py-2 text-left shadow-btn transition-colors hover:bg-hover active:bg-pressed disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block text-small font-medium text-fg-1">{labels[a.role] ?? a.name}</span>
                <span className="block text-caption text-fg-3">{a.org ? `${a.name} · ${a.org}` : a.name}</span>
              </span>
              <SampleChip label="Demo" />
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/** "Report an error" sheet: what's wrong, in a sentence. Demo: confirms with a toast, records nothing. */
export function ReportSheet({ person, open, onOpenChange }: SheetProps & { person: ProfilePerson }) {
  const fieldId = useId();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const change = (v: boolean) => {
    onOpenChange(v);
    if (!v) setError(null);
  };
  const send = () =>
    start(async () => {
      const res = await reportProfileError({ personId: person.id, message });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("");
      change(false);
      toast.show("Thanks. Reports aren't recorded in the demo.");
    });
  return (
    <Dialog
      open={open}
      onOpenChange={change}
      title="Report an error"
      description={`Tell us what's wrong on ${person.fullName}'s profile: a role, a year or a program.`}
      footer={(close) => (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={pending} onClick={send}>
            Send report
          </Button>
        </>
      )}
    >
      <Textarea
        id={fieldId}
        label="What's wrong?"
        required
        value={message}
        maxLength={2000}
        onChange={(e) => setMessage(e.target.value)}
        error={error ?? undefined}
        help="Name the role or year, and the right value if you know it."
      />
    </Dialog>
  );
}
