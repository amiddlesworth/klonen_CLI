"use client";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { markSearchPending, useSearchPending } from "./pending";

/** Builds the clean `/search?…` URL a facet form would submit (empty fields dropped). */
export function formHref(form: HTMLFormElement): string {
  const p = new URLSearchParams();
  for (const [k, v] of new FormData(form)) {
    if (typeof v === "string" && v.trim()) p.append(k, v.trim());
  }
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

type FacetFormProps = {
  id?: string;
  children: ReactNode;
  /** Accessible name of the form ("Search filters"). */
  label: string;
  className?: string;
};

/**
 * The facet panel's form. Without JavaScript it is a plain GET form to /search (an Apply button
 * sits in <noscript>). With JavaScript a checkbox change submits at once, and submitting navigates
 * client-side to a clean URL without empty fields, keeping the scroll position. While it loads, the
 * results dim and the Filters button shows a spinner (pending.ts).
 */
export function FacetForm({ id, children, label, className }: FacetFormProps) {
  const router = useRouter();
  // Busy from submit until the URL changes. (Not useTransition: wrapping the push in a transition
  // kept same-route navigations from committing.)
  const pending = useSearchPending();

  function go(form: HTMLFormElement) {
    const href = formHref(form);
    markSearchPending(href);
    router.push(href, { scroll: false });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    go(e.currentTarget);
  }

  return (
    <form
      id={id}
      method="get"
      action="/search"
      role="search"
      aria-label={label}
      aria-busy={pending || undefined}
      onSubmit={onSubmit}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.type === "checkbox") go(e.currentTarget);
      }}
      className={cn("flex min-w-0 flex-col", className)}
    >
      {children}
    </form>
  );
}
