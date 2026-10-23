"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type ToastOptions = { actionLabel?: string; onAction?: () => void };
type ToastState = ToastOptions & { id: number; message: string };
type ToastApi = { show: (message: string, options?: ToastOptions) => void; dismiss: () => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Shows a toast: `const toast = useToast(); toast.show("Link copied")`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider> (the AppShell provides one).");
  return ctx;
}

/**
 * Toast (§8.1): level 2, radius 8, 13px, max width 400; bottom-left 24px on desktop, above the tab
 * bar on phone. One line plus an optional "Undo" link. Auto-dismisses after 5s (paused on hover or
 * focus); role="status".
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
        className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+8px)] z-[60] flex md:inset-x-auto md:bottom-6 md:left-6"
      >
        {toast && (
          <div
            key={toast.id}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto flex w-full max-w-[400px] items-center gap-3 rounded-md bg-surface px-3.5 py-2.5 text-small text-fg-1 shadow-pop animate-pop-in md:w-auto"
          >
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="shrink-0 font-medium text-link hover:underline underline-offset-2"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
