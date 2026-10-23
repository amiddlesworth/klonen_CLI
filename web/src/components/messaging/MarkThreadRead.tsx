"use client";
import { useEffect, useRef, useTransition } from "react";
import { markThreadRead } from "@/lib/actions/messaging";

/**
 * Marks the open thread read once it is actually on screen: always on desktop, and on phone only on
 * the thread page (?thread=), where the pane is displayed. Runs once per thread, so "Mark as unread"
 * from the header menu sticks until the viewer opens the thread again.
 */
export function MarkThreadRead({ threadId, unread }: { threadId: string; unread: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (done.current === threadId) return;
    done.current = threadId;
    // A display:none ancestor (the phone list view) leaves the marker without an offsetParent.
    if (!unread || !ref.current || ref.current.offsetParent === null) return;
    startTransition(async () => {
      await markThreadRead(threadId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per thread, with the unread count it opened with
  }, [threadId]);

  return <span ref={ref} aria-hidden="true" className="block h-0" />;
}
