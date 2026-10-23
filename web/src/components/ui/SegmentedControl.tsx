"use client";
import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type SegmentOption = {
  value: string;
  label: string;
  /** When set, the segment is a link (URL-driven filters such as ?filter=). */
  href?: string;
};

type SegmentedControlProps = {
  options: SegmentOption[];
  value: string;
  /** Called with the new value for button segments. */
  onChange?: (value: string) => void;
  /** Accessible name ("Filter feed"). */
  label: string;
  /** Full width with equal segments on phone (default true). */
  fullWidthOnPhone?: boolean;
  className?: string;
};

const SEGMENT =
  "relative inline-flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 text-small font-medium transition-colors " +
  "max-md:h-10 max-md:px-1 max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-0.5";

/**
 * Segmented control (§8.1) for 2–4 short in-card options. Track --hover with 2px padding,
 * segments 28px (40px on phone with a 44px hit area); selected = --surface + 1px --border ring.
 */
export function SegmentedControl({ options, value, onChange, label, fullWidthOnPhone = true, className }: SegmentedControlProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isLinks = options.some((o) => o.href);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isLinks) return;
    const i = options.findIndex((o) => o.value === value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    if (next < 0) return;
    e.preventDefault();
    onChange?.(options[next].value);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  const track = cn(
    "inline-flex gap-0.5 rounded-sm bg-hover p-0.5",
    fullWidthOnPhone && "max-md:grid max-md:w-full max-md:auto-cols-fr max-md:grid-flow-col",
    className,
  );

  return (
    <div ref={ref} role={isLinks ? "group" : "radiogroup"} aria-label={label} className={track} onKeyDown={onKeyDown}>
      {options.map((o) => {
        const selected = o.value === value;
        const cls = cn(SEGMENT, selected ? "bg-surface text-fg-1 shadow-[0_0_0_1px_var(--border)]" : "text-fg-2 hover:text-fg-1");
        return o.href ? (
          <Link key={o.value} href={o.href} aria-current={selected ? "true" : undefined} scroll={false} className={cls}>
            {o.label}
          </Link>
        ) : (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange?.(o.value)}
            className={cls}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
