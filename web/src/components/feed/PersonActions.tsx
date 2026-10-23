"use client";
import { useState } from "react";
import { Check, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useCopyLink } from "./useCopyLink";

/** Connect icon button in people rows (§8.5): toggles to a pending request in this demo (aria-pressed). */
export function ConnectButton({ name }: { name: string }) {
  const [pending, setPending] = useState(false);
  return (
    <IconButton
      icon={UserPlus}
      pressedIcon={Check}
      pressed={pending}
      label={pending ? `Connection request to ${name} pending` : `Connect with ${name}`}
      variant="secondary"
      size="sm"
      onClick={() => setPending((p) => !p)}
    />
  );
}

/** "Invite to claim" (§8.5 PeopleYouMayKnow): copies the claim link for an unclaimed coach the viewer knows. */
export function InviteButton({ slug, first }: { slug: string; first: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCopyLink();
  return (
    <Button
      size="sm"
      icon={copied ? Check : Send}
      onClick={async () => {
        await copy(`/claim/${slug}`, `Invite link copied. Send it to ${first}.`);
        setCopied(true);
      }}
    >
      {copied ? "Invite link copied" : "Invite to claim"}
    </Button>
  );
}
