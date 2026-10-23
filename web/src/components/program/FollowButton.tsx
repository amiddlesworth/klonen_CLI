"use client";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { setProgramFollow } from "@/lib/actions/program";
import { cn } from "@/lib/cn";

type FollowButtonProps = {
  orgId: string;
  shortName: string;
  initialFollowing: boolean;
  className?: string;
};

/**
 * Follow (primary) → Following (secondary, check, aria-pressed). Optimistic; reverts with a toast
 * when the action fails. Signed-out visitors are pointed to the demo accounts in the Me menu.
 */
export function FollowButton({ orgId, shortName, initialFollowing, className }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function toggle() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const res = await setProgramFollow(orgId, next).catch(() => null);
      if (res?.ok) {
        toast.show(next ? `Following ${shortName}` : `Unfollowed ${shortName}`);
        return;
      }
      setFollowing(!next);
      toast.show(res?.reason === "signed_out" ? "Choose a demo account in the Me menu to follow programs." : "Couldn't update. Try again.");
    });
  }

  return (
    <Button
      variant="primary"
      icon={Plus}
      phone="large"
      pressed={following}
      aria-busy={pending || undefined}
      onClick={toggle}
      className={cn("min-w-[104px]", className)}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}
