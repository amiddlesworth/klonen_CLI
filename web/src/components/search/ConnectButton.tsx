"use client";
import { useState, useTransition } from "react";
import { Link2, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { requestConnection } from "@/lib/actions/search";
import { possessive } from "./params";

type ConnectButtonProps = {
  personId: string;
  slug: string;
  name: string;
  firstName: string;
  claimed: boolean;
  /** A fictional demo profile: no one to connect with or invite. */
  isDemo?: boolean;
};

/**
 * The row's icon button (§8.7 slot), 32px from tablet up (rule 7), 40px with a 44px hit area on phone.
 * A claimed profile gets Connect (`user-plus`): a pending request (server action), and the button
 * toggles to Pending. A profile built from public sources has no one to receive a request yet, so it
 * gets "Invite {first} to claim" (`send`, as in §8.5) instead of a Connect that wouldn't connect. A
 * fictional demo profile has no one behind it at all: Connect shows disabled (aria-disabled, so it
 * stays focusable with its tooltip), and a tap says why, since tooltips don't exist on touch.
 */
export function ConnectButton({ personId, slug, name, firstName, claimed, isDemo }: ConnectButtonProps) {
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  // The dialog mounts on first use (twenty rows would otherwise render twenty <dialog>s).
  const [inviteMounted, setInviteMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const [busy, startTransition] = useTransition();

  if (isDemo) {
    return (
      <IconButton
        icon={UserPlus}
        label="Demo profile, no one to connect with"
        variant="secondary"
        aria-disabled="true"
        onClick={() => toast.show(`${name} is a fictional demo profile, so there's no one to connect with or invite.`)}
      />
    );
  }

  function connect() {
    if (!claimed) {
      setInviteMounted(true);
      setInviteOpen(true);
      return;
    }
    startTransition(async () => {
      const res = await requestConnection(personId).catch(() => null);
      if (res?.ok) {
        setPending(true);
        toast.show(`Connection request sent to ${name}`);
      } else if (res && res.reason === "signed_out") toast.show("Choose a demo account in the Me menu to connect.");
      else if (res && res.reason === "not_coach") toast.show("Connections are for coach accounts.");
      else toast.show("Couldn't send the request. Try again.");
    });
  }

  async function copyInvite(close: () => void) {
    const url = `${window.location.origin}/claim/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.show(`Invite link for ${firstName} copied`);
    } catch {
      toast.show(`Copy this link: ${url}`);
    }
    close();
  }

  return (
    <>
      <IconButton
        icon={claimed ? UserPlus : Send}
        label={!claimed ? `Invite ${firstName} to claim` : pending ? `Request sent to ${name}` : `Connect with ${name}`}
        variant="secondary"
        pressed={claimed ? pending : undefined}
        loading={busy}
        onClick={connect}
      />
      {!claimed && inviteMounted && (
        <Dialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          title={`Invite ${firstName} to claim`}
          description={`${possessive(name)} profile was built from public sources and hasn't been claimed yet, so there's no one to connect with. Send ${firstName} the link to claim it.`}
          footer={(close) => (
            <>
              <Button onClick={close}>Cancel</Button>
              <Button variant="primary" icon={Link2} onClick={() => copyInvite(close)}>
                Copy invite link
              </Button>
            </>
          )}
        />
      )}
    </>
  );
}
