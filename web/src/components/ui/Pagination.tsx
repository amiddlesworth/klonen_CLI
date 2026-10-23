import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "./Button";

type PaginationProps = {
  page: number;
  totalPages: number;
  /** Link to the previous page, or null on the first page. */
  prevHref: string | null;
  /** Link to the next page, or null on the last page. */
  nextHref: string | null;
  className?: string;
};

/** Pagination (§8.1): Previous / Next secondary buttons plus "Page 2 of 9" (13px --fg-2). No numbered strip. */
export function Pagination({ page, totalPages, prevHref, nextHref, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-3", className)}>
      <ButtonLink href={prevHref ?? "#"} disabled={!prevHref} icon={ChevronLeft} rel="prev">
        Previous
      </ButtonLink>
      <span className="num text-small text-fg-2" aria-current="page">
        Page {page} of {totalPages}
      </span>
      <ButtonLink href={nextHref ?? "#"} disabled={!nextHref} iconRight={ChevronRight} rel="next">
        Next
      </ButtonLink>
    </nav>
  );
}

type ShowMoreProps = {
  /** "Show more {noun}" text. */
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
};

/** Full-width secondary "Show more {noun}" at the end of a truncated list (44px on phone). */
export function ShowMore({ children, href, onClick, loading, className }: ShowMoreProps) {
  if (href) {
    return (
      <ButtonLink href={href} fullWidth phone="large" className={className} scroll={false}>
        {children}
      </ButtonLink>
    );
  }
  return (
    <Button fullWidth phone="large" onClick={onClick} loading={loading} className={className}>
      {children}
    </Button>
  );
}
