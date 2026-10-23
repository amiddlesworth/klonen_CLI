import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A program name that never breaks inside its parenthetical (audit M4): "Pacific (OR)", "Saint John's
 * (MN)", "Pacific University (Oregon)". The space before "(" and the spaces inside it become no-break
 * spaces, so a line can't start with "(" or split "(New York)"; the rest of a long name still wraps.
 */
export function keepParen(name: string): string {
  return name.replace(/\s+\(/g, "\u00a0(").replace(/\([^)]*\)/g, (m) => m.replace(/\s+/g, "\u00a0"));
}

/**
 * "Title · Program" on one line (audit M2, DESIGN §12: truncate the title, never the context). The title
 * truncates first; the program stays whole unless it would leave the title less than ~76px (about ten
 * letters, so a long program name can't cut the title to a stub), and only then truncates too. Screen
 * readers hear "Title, Program".
 */
export function TitleOrg({ title, org, className }: { title?: ReactNode; org?: ReactNode; className?: string }) {
  if (!title || !org) {
    const only = title || org;
    return only ? <span className={cn("block truncate", className)}>{only}</span> : null;
  }
  return (
    <span className={cn("flex min-w-0", className)}>
      <span className="min-w-0 truncate">{title}</span>
      <span aria-hidden="true" className="mx-1 shrink-0">
        ·
      </span>
      <span className="max-w-[calc(100%-5.5rem)] shrink-0 truncate whitespace-nowrap">
        <span className="sr-only">, </span>
        {org}
      </span>
    </span>
  );
}
