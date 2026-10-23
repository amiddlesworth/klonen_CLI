"use client";
import { useState, useSyncExternalStore } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/*
 * Saved jobs are client state for the demo: kept in this browser (localStorage when available,
 * memory otherwise) and shared by every Save control on the page through one small store.
 */
const KEY = "cn_saved_jobs";
const listeners = new Set<() => void>();
let memory: number[] | null = null;

function read(): number[] {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    memory = Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    memory = [];
  }
  return memory;
}

function write(ids: number[]) {
  memory = ids;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode or blocked storage: keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      memory = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: number[] = [];

export function useSavedJob(id: number): [boolean, () => boolean] {
  const ids = useSyncExternalStore(subscribe, read, () => EMPTY);
  const saved = ids.includes(id);
  const toggle = () => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    write(next);
    return next.includes(id);
  };
  return [saved, toggle];
}

type SaveJobButtonProps = {
  jobId: number;
  title: string;
  /** "icon": square icon button (list rows, job cards); "label": "Save" / "Saved" (detail header). */
  variant?: "icon" | "label";
  /** Phone sizing: 44px for header and job-card actions. */
  large?: boolean;
  className?: string;
  wrapperClassName?: string;
  /**
   * A closed listing: nothing to save any more, so the control shows only when the viewer saved
   * the job earlier, to let them remove it. Once shown it stays until the page changes, so focus
   * isn't lost when it is pressed.
   */
  removeOnly?: boolean;
};

/** Save job (§7 bookmark): a toggle with aria-pressed and a toast. */
export function SaveJobButton({ jobId, title, variant = "icon", large, className, wrapperClassName, removeOnly }: SaveJobButtonProps) {
  const [saved, toggle] = useSavedJob(jobId);
  const [shown, setShown] = useState(false);
  const toast = useToast();
  // Remembered from an earlier render (React's "adjust state while rendering" pattern).
  if (removeOnly && saved && !shown) setShown(true);
  const onClick = () => {
    const now = toggle();
    toast.show(now ? `Saved "${title}" in this browser` : `Removed "${title}" from saved jobs`);
  };
  if (removeOnly && !saved && !shown) return null;
  if (variant === "label") {
    return (
      <Button variant="secondary" icon={saved ? BookmarkCheck : Bookmark} aria-pressed={saved} phone={large ? "large" : "default"} onClick={onClick} className={className}>
        {saved ? "Saved" : "Save"}
      </Button>
    );
  }
  return (
    <IconButton
      icon={Bookmark}
      pressedIcon={BookmarkCheck}
      pressed={saved}
      label={saved ? `Saved: ${title}` : `Save job: ${title}`}
      variant="secondary"
      phone={large ? "large" : "default"}
      onClick={onClick}
      className={cn(className)}
      wrapperClassName={wrapperClassName}
    />
  );
}
