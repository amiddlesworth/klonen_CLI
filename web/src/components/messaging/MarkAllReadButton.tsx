"use client";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { markAllNotificationsRead } from "@/lib/actions/messaging";

/** "Mark all as read" (§8.16): a ghost button in the notifications header (#notifications-title gets focus after). */
export function MarkAllReadButton() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={CheckCheck}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markAllNotificationsRead();
          // The button goes away once nothing is unread: keep keyboard focus in the card.
          if (res.ok) document.getElementById("notifications-title")?.focus();
          toast.show(res.ok ? "All notifications marked as read" : (res.error ?? "Something went wrong. Try again."));
        })
      }
    >
      Mark all as read
    </Button>
  );
}
