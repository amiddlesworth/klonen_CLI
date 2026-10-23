"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ToastOptions = { actionLabel?: string; onAction?: () => void };
type ToastState = ToastOptions & { id: number; message: string };
type ToastApi = { show: (message: string, options?: ToastOptions) => void; dismiss: () => void };

const ToastContext = createContext<ToastApi | null>(null);

/** The toast card look (level 2, radius 8, 13px, max width 400). */
export function ToastCard({ message, actionLabel, onAction, className, ...handlers }: { message: ReactNode; actionLabel?: string; onAction?: () => void; className?: string } & Pick<HTMLAttributes<HTMLDivElement>, "onMouseEnter" | "onMouseLeave" | "onFocus" | "onBlur">) {
  return (
    <div
      {...handlers}
      className={cn("pointer-events-auto flex w-full max-w-[400px] items-center gap-3 rounded-md bg-surface px-3.5 py-2.5 text-small text-fg-1 shadow-pop md:w-auto", className)}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {actionLabel && (
        <button type="button" className="shrink-0 font-medium text-link underline-offset-2 hover:underline" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** Shows a toast: `const toast = useToast(); toast.show("Link copied")`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider> (the AppShell provides one).");
  return ctx;
}

/**
 * Toast (§8.1): level 2, radius 8, 13px, max width 400; bottom-left 24px on desktop; on phone 12px
 * above whatever is at the bottom of the screen: the tab bar when the page has one, else the safe
 * area (`--tabbar-offset`, globals.css §6). One line plus an optional "Undo" link. Auto-dismisses
 * after 5s (paused on hover or focus); role="status".
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [paused, setPaused] = useState(false);
  const seq = useRef(0);

  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((message: string, options?: ToastOptions) => {
    seq.current += 1;
    setToast({ id: seq.current, message, ...options });
  }, []);

  useEffect(() => {
    if (!toast || paused) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast, paused]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--tabbar-offset)+12px)] z-[60] flex md:inset-x-auto md:bottom-6 md:left-6"
      >
        {toast && (
          <ToastCard
            key={toast.id}
            message={toast.message}
            actionLabel={toast.actionLabel}
            onAction={() => {
              toast.onAction?.();
              setToast(null);
            }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="animate-pop-in"
          />
        )}
      </div>
    </ToastContext.Provider>
  );
}
