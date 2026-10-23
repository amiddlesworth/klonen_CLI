"use client";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useOptimistic, useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import { sendMessage } from "@/lib/actions/messaging";
import { clockTime, dayKey, dayLabel, fullDateTime } from "./format";
import { MAX_MESSAGE_LENGTH } from "./limits";

export type ThreadViewPerson = { userId: string; name: string; tintKey: string; profileSlug: string | null };
export type ThreadViewMessage = { id: number; fromUserId: string; body: string; sentAt: string; pending?: boolean };

type ThreadViewProps = {
  threadId: string;
  me: ThreadViewPerson;
  other: ThreadViewPerson;
  messages: ThreadViewMessage[];
  /** On phone the thread is its own page (?thread=): scroll the window to the newest message. */
  scrollPageOnPhone: boolean;
  /** Shown above the first message (who the conversation is with, and the demo note). */
  intro?: ReactNode;
};

/** Messages from one sender within 5 minutes of each other share a header (§8.15). */
const GROUP_GAP_MS = 5 * 60_000;
/** The composer grows with its text up to 6 lines, then scrolls. */
const COMPOSER_MAX_LINES = 6;
const OFFLINE = "Your message wasn't sent. Check your connection and try again.";

type Group = { key: string; day: string | null; from: string; messages: ThreadViewMessage[] };

function groupMessages(messages: ThreadViewMessage[], now: Date, timeZone: string | undefined): Group[] {
  const groups: Group[] = [];
  let lastDay: string | null = null;
  for (const m of messages) {
    const at = new Date(m.sentAt);
    const day = dayKey(at, timeZone);
    const prev = groups[groups.length - 1];
    const prevMsg = prev?.messages[prev.messages.length - 1];
    const newDay = day !== lastDay;
    if (prev && !newDay && prev.from === m.fromUserId && at.getTime() - new Date(prevMsg!.sentAt).getTime() <= GROUP_GAP_MS) {
      prev.messages.push(m);
    } else {
      groups.push({ key: String(m.id), day: newDay ? dayLabel(at, now, timeZone) : null, from: m.fromUserId, messages: [m] });
    }
    lastDay = day;
  }
  return groups;
}

/**
 * The conversation and its composer (§8.15). Messages are flat, not bubbles: avatar 32, name 13/600,
 * time 12 --fg-3, text 14/20, grouped by sender within 5 minutes, with date dividers. The composer
 * auto-grows to 6 lines; Send (the view's one primary) is disabled while it's empty. On phone the
 * composer is one row (a 44px, one-line textarea with Send beside it); on md and up the textarea is
 * two lines with the keyboard hint and Send on a row below. A sent message shows at once ("Sending…")
 * and is replaced by the saved one when the page refreshes; if the request fails (offline), the draft
 * comes back with an error.
 */
export function ThreadView({ threadId, me, other, messages, scrollPageOnPhone, intro }: ThreadViewProps) {
  const [optimistic, addOptimistic] = useOptimistic(messages, (state, m: ThreadViewMessage) => [...state, m]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Clock times use the viewer's zone once mounted; the first render matches the server (UTC).
  const [timeZone, setTimeZone] = useState<string | undefined>("UTC");
  const logRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const composerId = `composer-${id}`;
  const errorId = `${composerId}-error`;

  useEffect(() => setTimeZone(undefined), []);

  // Keep the newest message in view: inside the pane on desktop, the page on the phone thread page.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    if (log.scrollHeight > log.clientHeight + 1 && getComputedStyle(log).overflowY !== "visible") {
      log.scrollTop = log.scrollHeight;
    } else if (scrollPageOnPhone && endRef.current && window.matchMedia("(max-width: 720px)").matches) {
      // The composer is sticky above the fixed tab bar: keep the newest message clear of both.
      const covered = (formRef.current?.offsetHeight ?? 0) + (document.querySelector<HTMLElement>("[data-tabbar]")?.offsetHeight ?? 0);
      endRef.current.style.scrollMarginBottom = `${covered + 8}px`;
      endRef.current.scrollIntoView({ block: "end" });
    }
  }, [optimistic.length, threadId, scrollPageOnPhone]);

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    const css = getComputedStyle(el);
    const chrome = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom) + parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
    const max = COMPOSER_MAX_LINES * parseFloat(css.lineHeight) + chrome;
    el.style.height = "auto";
    const needed = el.scrollHeight + parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
    el.style.height = `${Math.min(needed, max)}px`;
    el.style.overflowY = needed > max ? "auto" : "hidden";
  }

  function restore(text: string, message: string) {
    setError(message);
    setBody(text);
    requestAnimationFrame(() => {
      resize();
      textareaRef.current?.focus();
    });
  }

  const trimmed = body.trim();
  const tooLong = trimmed.length > MAX_MESSAGE_LENGTH;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!trimmed || tooLong || pending) return;
    const text = trimmed;
    setError(null);
    setBody("");
    requestAnimationFrame(resize);
    startTransition(async () => {
      addOptimistic({ id: -Date.now(), fromUserId: me.userId, body: text, sentAt: new Date().toISOString(), pending: true });
      try {
        const res = await sendMessage({ threadId, body: text });
        if (!res.ok) restore(text, res.error);
      } catch {
        // Offline, a dropped connection or a stale action id: keep the page and the draft.
        restore(text, OFFLINE);
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends on devices with a keyboard and a fine pointer; Shift+Enter adds a line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
      e.preventDefault();
      submit();
    }
  }

  const now = new Date();
  const groups = groupMessages(optimistic, now, timeZone);
  const people = new Map([me, other].map((p) => [p.userId, p]));

  return (
    <>
      <div
        ref={logRef}
        role="log"
        aria-label={`Messages with ${other.name}`}
        tabIndex={0}
        className="min-h-0 flex-1 px-4 pb-4 focus-visible:-outline-offset-2 md:overflow-y-auto md:px-6"
      >
        {intro}
        {groups.map((g) => {
          const who = people.get(g.from) ?? { userId: g.from, name: "Unknown", tintKey: g.from, profileSlug: null };
          const first = g.messages[0];
          const at = new Date(first.sentAt);
          return (
            <div key={g.key}>
              {g.day && (
                <h3 className="flex items-center gap-3 pb-1 pt-5 text-caption font-medium text-fg-3 before:h-px before:flex-1 before:bg-divider after:h-px after:flex-1 after:bg-divider">
                  {g.day}
                </h3>
              )}
              <div className="flex gap-3 pt-4">
                <Avatar name={who.name} tintKey={who.tintKey} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 leading-5">
                    {who.profileSlug ? (
                      <Link href={`/in/${who.profileSlug}`} className="target-24 text-small font-semibold text-fg-1 underline-offset-2 hover:underline">
                        {who.name}
                      </Link>
                    ) : (
                      <span className="text-small font-semibold text-fg-1">{who.name}</span>
                    )}
                    {first.pending ? (
                      <span className="text-caption text-fg-3">Sending…</span>
                    ) : (
                      <time dateTime={first.sentAt} title={fullDateTime(at, timeZone)} className="num text-caption text-fg-3">
                        {clockTime(at, timeZone)}
                      </time>
                    )}
                  </p>
                  {g.messages.map((m, i) => (
                    <p
                      key={m.id}
                      title={i > 0 && !m.pending ? clockTime(new Date(m.sentAt), timeZone) : undefined}
                      className={cn("max-w-prose whitespace-pre-wrap text-body text-fg-1 [overflow-wrap:anywhere]", i > 0 && "mt-1", m.pending && "text-fg-2")}
                    >
                      {m.body}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        ref={formRef}
        onSubmit={submit}
        className="z-10 flex flex-wrap items-end gap-x-2 border-t border-divider bg-surface px-4 py-3 max-md:sticky max-md:bottom-[var(--tabbar-offset)] md:items-center md:gap-x-3 md:px-6"
      >
        <label htmlFor={composerId} className="sr-only">
          Write a message to {other.name}
        </label>
        <Textarea
          ref={textareaRef}
          id={composerId}
          rows={1}
          value={body}
          maxLength={MAX_MESSAGE_LENGTH + 200}
          placeholder="Write a message…"
          error={error ?? (tooLong ? "Too long" : undefined)}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
            resize();
          }}
          onKeyDown={onKeyDown}
          className="min-h-11 flex-1 resize-none overflow-y-hidden py-[11px] md:min-h-[62px] md:basis-full md:py-2"
        />
        {(error || tooLong) && (
          <p id={errorId} className="order-last mt-1.5 flex basis-full items-start gap-1 text-caption text-danger md:order-none">
            <Icon icon={CircleAlert} size={12} className="mt-0.5" />
            <span>{error ?? `Keep messages under ${MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters.`}</span>
          </p>
        )}
        <p className="mr-auto mt-2 text-caption text-fg-3 max-md:hidden">Enter to send · Shift+Enter for a new line</p>
        {trimmed.length > MAX_MESSAGE_LENGTH - 200 && (
          <span className={cn("num text-caption max-md:order-last max-md:mt-1.5 max-md:basis-full max-md:text-right md:mt-2", tooLong ? "text-danger" : "text-fg-3")}>
            {trimmed.length.toLocaleString("en-US")} / {MAX_MESSAGE_LENGTH.toLocaleString("en-US")}
          </span>
        )}
        <Button type="submit" variant="primary" phone="large" disabled={!trimmed || tooLong} loading={pending} className="md:mt-2">
          Send
        </Button>
      </form>
    </>
  );
}
