"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";

/**
 * Follow icon button on a program result (§8.7). Follows are demo-only (nothing is stored), so the
 * toggle lives in the page and the toast says so.
 */
export function FollowButton({ name }: { name: string }) {
  const toast = useToast();
  const [following, setFollowing] = useState(false);
  return (
    <IconButton
      icon={Plus}
      label={following ? `Following ${name}` : `Follow ${name}`}
      variant="secondary"
      size="sm"
      pressed={following}
      onClick={() => {
        setFollowing((f) => !f);
        toast.show(following ? `Unfollowed ${name}` : `Following ${name} · demo, not saved`);
      }}
    />
  );
}
