import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

/** The brand mark: a three-node tree (one node above two) on a 24px ink square, radius 6 (§7). */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("grid size-6 shrink-0 place-items-center rounded-sm bg-fg-1 text-surface", className)}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4.5v2.5M3.5 10V7h7v3" />
        <circle cx="7" cy="2.75" r="1.75" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="11.25" r="1.75" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="11.25" r="1.75" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

type BrandMarkProps = {
  href: string;
  /** "full": mark + wordmark (wordmark visually hidden at 721–900px); "mark": the mark only. */
  variant?: "full" | "mark";
  className?: string;
};

/** Brand link: mark + wordmark 15/650. The name comes from BRAND only. */
export function BrandMark({ href, variant = "full", className }: BrandMarkProps) {
  return (
    <Link
      href={href}
      aria-label={variant === "mark" ? `${BRAND.name} home` : undefined}
      className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm text-[15px] font-[650] tracking-[-0.015em] text-fg-1", className)}
    >
      <BrandGlyph />
      {variant === "full" && <span className="md:max-[901px]:sr-only">{BRAND.name}</span>}
    </Link>
  );
}
