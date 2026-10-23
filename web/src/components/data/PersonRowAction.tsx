"use client";
import { useState, useTransition } from "react";
import { Check, Send, UserPlus } from "lucide-react";
import { possessive } from "@/components/search/params";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { requestConnection } from "@/lib/actions/profile";

export type RowPerson = {
  id: string;
  slug: string;
  fullName: string;
  /** First name for the invite copy; falls back to the first word of the full name. */
  firstName?: string | null;
  claimed: boolean;
  /** A fictional demo profile: no one to connect with or invite. */
  isDemo?: boolean;
};

const firstOf = (p: RowPerson) => p.firstName?.trim() || p.fullName.split(/\s+/)[0] || p.fullName;

/**
 * "Invite {first} to claim" (§8.4, §8.5): a profile built from public sources has no one behind it to
 * receive a connection request, so the row action explains that and copies the claim link instead.
 * Works for every viewer, signed in or not. Mounted on first use (a page of rows would otherwise render
 * one <dialog> per row).
 */
function InviteDialog({ person, reason, open, onOpenChange }: { person: RowPerson; reason: "connect" | "invite"; open: boolean; onOpenChange: (v: boolean) => void }) {
  const toast = useToast();
  const first = firstOf(person);
  async function copyInvite(close: () => void) {
    const url = `${window.location.origin}/claim/${person.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.show(`Invite link for ${first} copied`);
    } catch {
      toast.show(`Copy this link: ${url}`);
    }
    close();
  }
  const built = `${possessive(person.fullName)} profile was built from public sources and hasn't been claimed yet`;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Invite ${first} to claim`}
      description={
        reason === "connect"
          ? `${built}, so a connection request can't reach ${first} here. Send ${first} the link to claim it.`
          : `${built}. Send ${first} the link to claim it, check each role and add an About.`
      }
      footer={(close) => (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" icon={Send} onClick={() => copyInvite(close)}>
            Copy invite link
          </Button>
        </>
      )}
    />
  );
}

/**
 * The one action on a person row (audit C02; rule 8: Connect is the only icon-only control in list
 * rows): the `user-plus` Connect icon button, `sm` in rails and feed rows, `md` in search results, named
 * "Connect with {name}" with a tooltip, and a 44px hit area on touch. Search, Same tree, People you may
 * know and grouped hires all use it.
 *
 * - Claimed profile: a pending connection request (server action); the button turns pressed with a check.
 * - Unclaimed profile (every real profile today): nobody can receive a request, so it opens the
 *   "Invite {first} to claim" dialog instead of pretending a request is pending (§8.4).
 * - Fictional demo profile: shown disabled (aria-disabled keeps it focusable with its tooltip); a tap
 *   says why, since tooltips don't exist on touch.
 */
export function PersonRowAction({ person, size = "sm" }: { person: RowPerson; size?: "sm" | "md" }) {
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMounted, setInviteMounted] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, startTransition] = useTransition();

  if (person.isDemo) {
    return (
      <IconButton
        icon={UserPlus}
        label={`${person.fullName} is a demo profile, no one to connect with`}
        variant="secondary"
        size={size}
        aria-disabled="true"
        onClick={() => toast.show(`${person.fullName} is a fictional demo profile, so there's no one to connect with or invite.`)}
      />
    );
  }

  function connect() {
    if (!person.claimed) {
      setInviteMounted(true);
      setInviteOpen(true);
      return;
    }
    if (sent) return;
    startTransition(async () => {
      const res = await requestConnection(person.id).catch(() => null);
      if (res?.ok) {
        setSent(true);
        toast.show(`Connection request sent to ${person.fullName}`);
      } else toast.show(res ? res.error : "Couldn't send the request. Try again.");
    });
  }

  return (
    <>
      <IconButton
        icon={UserPlus}
        pressedIcon={Check}
        label={sent ? `Connection request sent to ${person.fullName}` : `Connect with ${person.fullName}`}
        variant="secondary"
        size={size}
        pressed={person.claimed ? sent : undefined}
        loading={busy}
        onClick={connect}
      />
      {!person.claimed && inviteMounted && <InviteDialog person={person} reason="connect" open={inviteOpen} onOpenChange={setInviteOpen} />}
    </>
  );
}

/**
 * The labelled "Invite to claim" button (§8.5 People you may know): only for an unclaimed coach the
 * viewer already knows, whose reason line says the profile hasn't been claimed. Opens the same dialog.
 */
export function InviteToClaimButton({ person }: { person: RowPerson }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <Button
        size="sm"
        icon={Send}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        {/* A distinct name per row (audit m6) that still starts with the visible label (WCAG 2.5.3). */}
        Invite to claim<span className="sr-only"> {possessive(person.fullName)} profile</span>
      </Button>
      {mounted && <InviteDialog person={person} reason="invite" open={open} onOpenChange={setOpen} />}
    </>
  );
}
