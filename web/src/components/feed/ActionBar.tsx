"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, Forward, Handshake, Mail, MessageCircle, Plus } from "lucide-react";
import { DemoLabel } from "@/components/data/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { useCopyLink } from "./useCopyLink";

type ActionBarProps = {
  /** "person": Congratulate · Comment · Message · Share. "program": Congratulate · Comment · Follow · Share. */
  set: "person" | "program";
  /** Who the item is about ("Tanner Kingsley", "George Fox"). */
  subject: string;
  /** First name (or program short name) for labels. */
  short: string;
  /** Site path that Share copies (the profile or program page). */
  sharePath: string;
  /** Stable key for this item (remembers Congratulate in this browser). */
  itemKey: string;
  viewer: { name: string; tintKey: string };
};

// Four fixed slots (§8.5 ActionBar): 40px ghost buttons with icon + 13px label on desktop;
// 52px cells with the icon over a 12px label on phone. Slots never collapse or reorder.
const SLOT =
  "h-10 w-full min-w-0 px-2 text-fg-2 hover:text-fg-1 " +
  "max-md:h-[52px] max-md:flex-col max-md:gap-0.5 max-md:px-0.5 max-md:text-caption max-md:leading-4";

const STORE = "cn-feed-congrats";

function readCongrats(key: string): boolean {
  try {
    return (JSON.parse(window.localStorage.getItem(STORE) ?? "[]") as string[]).includes(key);
  } catch {
    return false;
  }
}

function writeCongrats(key: string, on: boolean) {
  try {
    const list = new Set(JSON.parse(window.localStorage.getItem(STORE) ?? "[]") as string[]);
    if (on) list.add(key);
    else list.delete(key);
    window.localStorage.setItem(STORE, JSON.stringify([...list].slice(-500)));
  } catch {
    // Storage blocked (private window): the toggle still works for this page view.
  }
}

/** The feed item action bar. Demo actions: nothing here is sent or stored on the server. */
export function ActionBar({ set, subject, short, sharePath, itemKey, viewer }: ActionBarProps) {
  const [congrats, setCongrats] = useState(false);
  const [following, setFollowing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const copy = useCopyLink();

  useEffect(() => setCongrats(readCongrats(itemKey)), [itemKey]);
  useEffect(() => {
    if (composerOpen) inputRef.current?.focus();
  }, [composerOpen]);

  const count = congrats ? 1 : 0;

  function toggleCongrats() {
    const next = !congrats;
    setCongrats(next);
    writeCongrats(itemKey, next);
  }

  function post(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setComments((c) => [...c, text]);
    setDraft("");
  }

  return (
    <>
      {count > 0 && (
        <p className="mt-3 flex items-center gap-1 px-4 text-caption text-fg-3">
          <Icon icon={Handshake} size={12} className="text-fg-2" />
          <span className="num">{count}</span> {count === 1 ? "congratulation" : "congratulations"}
          <span className="sr-only">, from you</span>
        </p>
      )}
      <div role="group" aria-label={`Actions for ${subject}`} className={cn("grid grid-cols-4 border-t border-divider px-2 py-1 max-md:px-0 max-md:py-0.5", count > 0 ? "mt-2" : "mt-3")}>
        <Button variant="ghost" phone="none" aria-pressed={congrats} onClick={toggleCongrats} className={cn(SLOT, congrats && "text-fg-1")}>
          <Icon icon={Handshake} size={16} strokeWidth={congrats ? 2.25 : undefined} />
          <span className={cn("truncate", congrats && "font-semibold")}>{congrats ? "Congratulated" : "Congratulate"}</span>
        </Button>
        <Button
          variant="ghost"
          phone="none"
          aria-expanded={composerOpen}
          aria-controls={composerOpen ? `${id}-comments` : undefined}
          onClick={() => setComposerOpen((o) => !o)}
          className={cn(SLOT, composerOpen && "text-fg-1")}
        >
          <Icon icon={MessageCircle} size={16} />
          <span className="truncate">Comment</span>
        </Button>
        {set === "person" ? (
          <ButtonLink href="/messaging" variant="ghost" phone="none" className={SLOT} aria-label={`Message ${subject}`}>
            <Icon icon={Mail} size={16} />
            <span className="truncate">Message</span>
          </ButtonLink>
        ) : (
          <Button
            variant="ghost"
            phone="none"
            aria-pressed={following}
            aria-label={`Follow ${subject}`}
            onClick={() => setFollowing((f) => !f)}
            className={cn(SLOT, following && "text-fg-1")}
          >
            <Icon icon={following ? Check : Plus} size={16} />
            <span className={cn("truncate", following && "font-semibold")}>{following ? "Following" : "Follow"}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          phone="none"
          aria-label={`Share ${subject}`}
          onClick={() => copy(sharePath, set === "person" ? `Link to ${short}'s profile copied` : `Link to ${subject} copied`)}
          className={SLOT}
        >
          <Icon icon={Forward} size={16} />
          <span className="truncate">Share</span>
        </Button>
      </div>
      {composerOpen && (
        <div id={`${id}-comments`} className="border-t border-divider px-4 py-3">
          {comments.length > 0 && (
            <ul className="mb-3 flex flex-col gap-3" aria-label="Your comments">
              {comments.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Avatar name={viewer.name} tintKey={viewer.tintKey} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-small font-semibold">
                      {viewer.name}
                      <DemoLabel />
                    </p>
                    <p className="text-small leading-5 text-fg-1 [overflow-wrap:anywhere]">{c}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={post} className="flex items-center gap-2">
            <Avatar name={viewer.name} tintKey={viewer.tintKey} size={32} className="max-md:hidden" />
            <label htmlFor={`${id}-input`} className="sr-only">
              Comment on {subject}&apos;s update
            </label>
            <Input
              ref={inputRef}
              id={`${id}-input`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Congratulate ${short} or add a note`}
              maxLength={500}
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={!draft.trim()}>
              Post
            </Button>
          </form>
          <p className="mt-2 text-caption text-fg-3">Demo: comments stay on this page and aren&apos;t sent.</p>
        </div>
      )}
    </>
  );
}
