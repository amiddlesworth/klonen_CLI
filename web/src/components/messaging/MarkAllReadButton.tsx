"use client";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { markAllNotificationsRead } from "@/lib/actions/messaging";
import type { NotificationFilter } from "@/lib/queries/messaging";

const FAILED = "We couldn't mark your notifications as read. Try again.";

/**
 * "Mark all as read" (§8.16): a ghost button in the notifications header, 32px on desktop and 40px
 * (44px hit area) on phone. Under a filter it marks only what that filter shows. #notifications-title
 * gets focus after; a failed request shows a toast.
 */
export function MarkAllReadButton({ filter = "all" }: { filter?: NotificationFilter }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      icon={CheckCheck}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const res = await markAllNotificationsRead(filter);
            // The button goes away once nothing is unread: keep keyboard focus in the card.
            if (res.ok) document.getElementById("notifications-title")?.focus();
            toast.show(res.ok ? (filter === "all" ? "All notifications marked as read" : "Marked as read") : (res.error ?? FAILED));
          } catch {
            toast.show(FAILED);
          }
        })
      }
    >
      Mark all as read
    </Button>
  );
}
