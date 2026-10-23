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

/** Legal footer (§8.2): 12px --fg-3, 24px line height, then "{BRAND} © year". */
export function LegalFooter({ align = "start", className }: { align?: "start" | "center"; className?: string }) {
  return (
    <footer className={cn("px-1 pt-1 text-caption leading-6 text-fg-3 max-md:px-4 max-md:pt-2", align === "center" && "text-center", className)}>
      <nav aria-label="Footer">
        <ul className={cn("flex flex-wrap gap-x-3", align === "center" && "justify-center")}>
          {LEGAL_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-xs hover:text-fg-1 hover:underline underline-offset-2">
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
