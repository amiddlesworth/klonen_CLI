import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

export const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/about#data-sources", label: "Data sources" },
  { href: "/about#accessibility", label: "Accessibility" },
  { href: "/about#privacy", label: "Privacy" },
  { href: "/about#terms", label: "Terms" },
];

/** Legal footer (§8.2): 12px --fg-3, 24px line height (each link a 24px tall target), then "{BRAND} © year". */
export function LegalFooter({ align = "start", className }: { align?: "start" | "center"; className?: string }) {
  return (
    <footer className={cn("px-1 pt-1 text-caption leading-6 text-fg-3 max-md:px-4 max-md:pt-2", align === "center" && "text-center", className)}>
      <nav aria-label="Footer">
        <ul className={cn("flex flex-wrap gap-x-3", align === "center" && "justify-center")}>
          {LEGAL_LINKS.map((l) => (
            <li key={l.href}>
              {/* A 24px tall box, not just the glyphs: links outside sentences need a 24px target (§11 rule 7). */}
              <Link href={l.href} className="inline-flex min-h-6 items-center rounded-xs underline-offset-2 hover:text-fg-1 hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p>
        {BRAND.name} © {new Date().getFullYear()}
      </p>
    </footer>
  );
}
