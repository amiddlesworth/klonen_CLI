"use client";
import { useEffect, useRef, useTransition } from "react";
import { markNotificationsSeen } from "@/lib/actions/messaging";

/**
 * Opening /notifications clears the Notifications badge (audit X22): once per visit, when there is
 * something new to clear, it records the visit for this browser. The rows keep their unread look until
 * they are clicked or marked read. Failures are ignored: the badge just stays.
 */
export function MarkNotificationsSeen({ hasNew }: { hasNew: boolean }) {
  const done = useRef(false);
  const [, startTransition] = useTransition();
  useEffect(() => {
    if (!hasNew || done.current) return;
    done.current = true;
    startTransition(async () => {
      try {
        await markNotificationsSeen();
      } catch {
        // Offline or a stale action.
      }
    });
  }, [hasNew]);
  return null;
}
