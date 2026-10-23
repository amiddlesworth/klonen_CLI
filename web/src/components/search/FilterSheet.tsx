"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ListFilter, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SHEET_HANDLE } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { isSearchPending, useSearchPending } from "./pending";

type FilterSheetProps = {
  /** Applied filters, for "Filters (n)". */
  applied: number;
  /** Live result count; at 0 the footer offers a way out instead of "Show 0 coaches". */
  total: number;
  /** "Show 62 coaches": the sheet's one primary action. */
  showLabel: string;
  /** Caption when nothing matches ("No coaches match these filters."). */
  emptyLabel: string;
  /** Link that clears every filter (shown when any is applied). */
  clearHref: string;
  /** id of the facet form inside the sheet; "Show" submits it (keywords typed but not entered). */
  formId: string;
  /** The facet panel (sheet variant). */
  children: ReactNode;
  className?: string;
};

/** Set when the sheet unmounts while open (a facet change moved between the start page and results). */
const REOPEN_KEY = "search-filter-sheet-open";
const REOPEN_WINDOW_MS = 5000;

function takeReopen(): boolean {
  try {
    const t = Number(window.sessionStorage.getItem(REOPEN_KEY));
    window.sessionStorage.removeItem(REOPEN_KEY);
    return Number.isFinite(t) && t > 0 && Date.now() - t < REOPEN_WINDOW_MS;
  } catch {
    return false;
  }
}

function markReopen() {
  try {
    window.sessionStorage.setItem(REOPEN_KEY, String(Date.now()));
  } catch {
    /* storage blocked: the sheet simply stays closed */
  }
}

/**
 * Tablet and phone facets (§8.7): a "Filters (n)" secondary button opens a full-height sheet
 * (bottom sheet on phone, right-hand panel on tablet). Native <dialog> with showModal(): focus is
 * trapped, Esc and the scrim close it, focus returns to the button. Checkbox changes apply at once
 * behind the sheet; the footer shows the live result count. While a change loads, the footer button
 * and the Filters button show a spinner; "Show" waits for the results before closing.
 */
export function FilterSheet({ applied, total, showLabel, emptyLabel, clearHref, formId, children, className }: FilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [closeWhenLoaded, setCloseWhenLoaded] = useState(false);
  const pending = useSearchPending();
  const ref = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const openRef = useRef(false);
  const titleId = useId();
  const captionId = useId();

  useEffect(() => {
    openRef.current = open;
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
      wasOpen.current = true;
    } else if (!open && d.open) {
      d.close();
    }
    if (!open && wasOpen.current) {
      wasOpen.current = false;
      document.documentElement.style.overflow = "";
      triggerRef.current?.focus();
    }
  }, [open]);

  // The page swapped this sheet for another one mid-change (start page ↔ results): reopen it there.
  useEffect(() => {
    if (takeReopen()) setOpen(true);
    return () => {
      if (openRef.current) markReopen();
      document.documentElement.style.overflow = "";
    };
  }, []);

  // "Show" pressed while results were loading: close once they arrive.
  useEffect(() => {
    if (closeWhenLoaded && !pending) {
      setCloseWhenLoaded(false);
      setOpen(false);
    }
  }, [closeWhenLoaded, pending]);

  function show() {
    (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
    if (isSearchPending()) setCloseWhenLoaded(true);
    else setOpen(false);
  }

  return (
    <>
      <Button
        ref={triggerRef}
        icon={ListFilter}
        loading={pending && !open}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={applied ? `Filters, ${applied} applied` : "Filters"}
        className={className}
      >
        Filters{applied > 0 && <span className="num"> ({applied})</span>}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          // A click on the dialog box itself (outside the panel) is a click on the scrim.
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className={cn(
          "fixed m-0 max-h-none max-w-none bg-surface p-0 text-fg-1 shadow-pop backdrop:bg-overlay open:flex open:flex-col",
          "inset-x-0 bottom-0 top-auto h-[calc(100dvh-24px)] w-full rounded-t-lg",
          "md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:w-[400px] md:rounded-none",
        )}
      >
        {open && (
          <>
            <div className="shrink-0 border-b border-divider px-4 pb-3 pt-2 md:px-6 md:pt-4">
              <span aria-hidden="true" className={cn(SHEET_HANDLE, "mb-2")} />
              <div className="flex items-center justify-between gap-3">
                <h2 id={titleId} className="text-title">
                  Filters
                </h2>
                <div className="flex items-center gap-2">
                  {applied > 0 && (
                    <Link
                      href={clearHref}
                      scroll={false}
                      className="inline-flex h-10 items-center rounded-sm px-2 text-small font-medium text-link underline-offset-2 hover:underline md:h-8"
                    >
                      Clear all
                    </Link>
                  )}
                  <IconButton icon={X} label="Close filters" onClick={() => setOpen(false)} />
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">{children}</div>
            <div className="shrink-0 border-t border-divider px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-6">
              {total === 0 && !pending ? (
                <>
                  <p id={captionId} role="status" className="mb-2 text-center text-small text-fg-2">
                    {emptyLabel}
                  </p>
                  {applied > 0 ? (
                    <ButtonLink href={clearHref} scroll={false} fullWidth phone="large" aria-describedby={captionId}>
                      Clear filters
                    </ButtonLink>
                  ) : (
                    <Button fullWidth phone="large" onClick={() => setOpen(false)} aria-describedby={captionId}>
                      Close
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="primary" fullWidth phone="large" loading={pending} onClick={show}>
                  {showLabel}
                </Button>
              )}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
