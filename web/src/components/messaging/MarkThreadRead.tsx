"use client";
import { useEffect, useRef, useTransition } from "react";
import { markThreadRead } from "@/lib/actions/messaging";

type MarkThreadReadProps = {
  threadId: string;
  unread: number;
  /** The viewer opened this thread (?thread=). Otherwise it is only the newest one, shown by default on desktop. */
  explicit: boolean;
};

/**
 * Marks the open thread read once the viewer has actually opened it: right away when it was chosen
 * (?thread=, or ?to= for someone with a conversation) and is on screen, or, for the thread desktop
 * shows by default, only once the viewer interacts with it (a click, a tap, focus or a key inside the
 * thread pane). Just loading /messaging leaves the shared demo account's unread state alone. A marker
 * that mounts hidden (the phone inbox view, or a subtree still being revealed after a navigation) is
 * watched and arms as soon as it shows, so every way of opening a thread behaves the same. Runs once
 * per thread, so "Mark as unread" from the header menu sticks until the viewer opens the thread
 * again. Failures are ignored: marking read is a background side effect and must never replace the page.
 */
export function MarkThreadRead({ threadId, unread, explicit }: MarkThreadReadProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const marker = ref.current;
    if (done.current === threadId || !unread || !marker) return;
    const mark = () => {
      if (done.current === threadId) return;
      done.current = threadId;
      startTransition(async () => {
        try {
          await markThreadRead(threadId);
        } catch {
          // Offline or a stale action: the thread just stays unread.
        }
      });
    };
    let detach = () => {};
    const arm = () => {
      if (explicit) return mark();
      const pane = marker.closest("section");
      if (!pane) return;
      const events = ["pointerdown", "focusin", "keydown"] as const;
      events.forEach((type) => pane.addEventListener(type, mark, { once: true }));
      detach = () => events.forEach((type) => pane.removeEventListener(type, mark));
    };
    // A display:none ancestor leaves the marker without an offsetParent.
    if (marker.offsetParent !== null) {
      arm();
      return () => detach();
    }
    // Hidden for now: arm once it shows (the marker gets a width when it does).
    const observer = new ResizeObserver(() => {
      if (marker.offsetParent === null) return;
      observer.disconnect();
      arm();
    });
    observer.observe(marker);
    return () => {
      observer.disconnect();
      detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per thread, with the unread count it opened with
  }, [threadId, explicit]);

  return <span ref={ref} aria-hidden="true" className="block h-0" />;
}
