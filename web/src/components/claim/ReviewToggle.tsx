"use client";
import { forwardRef, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type Review = "correct" | "fix";

const OPTIONS: { value: Review; label: string }[] = [
  { value: "correct", label: "Correct" },
  { value: "fix", label: "Needs a fix" },
];

// The SegmentedControl look (§8.1): --hover track with 2px padding, 28px segments (40px with a 44px
// hit area on phone), selected = --surface + 1px --border ring. Unlike SegmentedControl it starts
// with nothing selected, so a coach has to look at every stint.
const SEGMENT =
  "relative inline-flex h-7 min-w-0 items-center justify-center whitespace-nowrap rounded-[5px] px-3 text-small font-medium transition-colors " +
  "max-md:h-10 max-md:px-1 max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-0.5";

type ReviewToggleProps = {
  value: Review | null;
  onChange: (value: Review) => void;
  /** Accessible name: "Review: Head Football Coach, Pacific (OR)". */
  label: string;
  invalid?: boolean;
  describedBy?: string;
};

/** Correct · Needs a fix radio pair for one stint. Arrow keys move and select; Tab stops once. */
export const ReviewToggle = forwardRef<HTMLDivElement, ReviewToggleProps>(function ReviewToggle({ value, onChange, label, invalid, describedBy }, ref) {
  const inner = useRef<HTMLDivElement | null>(null);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = Math.max(0, OPTIONS.findIndex((o) => o.value === value));
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % OPTIONS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + OPTIONS.length) % OPTIONS.length;
    if (next < 0) return;
    e.preventDefault();
    onChange(OPTIONS[next].value);
    inner.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex gap-0.5 rounded-sm bg-hover p-0.5 max-md:grid max-md:w-full max-md:grid-cols-2",
        invalid && "shadow-[0_0_0_1px_var(--danger)]",
      )}
    >
      {OPTIONS.map((o, i) => {
        const selected = o.value === value;
        const tabbable = value ? selected : i === 0;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(SEGMENT, selected ? "bg-surface text-fg-1 shadow-[0_0_0_1px_var(--border)]" : "text-fg-2 hover:text-fg-1")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
});
