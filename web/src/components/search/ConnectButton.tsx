"use client";
import { useState, useTransition } from "react";
import { Link2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { requestConnection } from "@/lib/actions/search";

type ConnectButtonProps = {
  personId: string;
  slug: string;
  name: string;
  firstName: string;
  claimed: boolean;
};

/**
 * Connect icon button on a person result (§8.7). A profile built from public sources has no one to
 * receive a request yet, so Connect opens "Invite {first} to claim" (as on the profile, §8.4);
 * a claimed profile gets a pending request (server action) and the button toggles to Pending.
 */
export function ConnectButton({ personId, slug, name, firstName, claimed }: ConnectButtonProps) {
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  // The dialog mounts on first use (twenty rows would otherwise render twenty <dialog>s).
  const [inviteMounted, setInviteMounted] = useState(false);
  const [pending, setPending] = useState(false);
  const [busy, startTransition] = useTransition();

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
        icon={UserPlus}
        label={pending ? `Request sent to ${name}` : `Connect with ${name}`}
        variant="secondary"
        size="sm"
        pressed={claimed ? pending : undefined}
        loading={busy}
        onClick={connect}
      />
      {!claimed && inviteMounted && (
        <Dialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          title={`Invite ${firstName} to claim`}
          description={`${name}'s profile was built from public sources and hasn't been claimed yet, so a connection request has no one to reach. Send ${firstName} the link to claim it.`}
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
