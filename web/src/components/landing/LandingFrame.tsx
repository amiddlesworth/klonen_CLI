import type { ReactNode } from "react";
import { LegalFooter } from "@/components/shell/LegalFooter";

/**
 * Landing page frame: the page container (max 1200, 24px gutters from md; phone cards full-bleed),
 * the single <main id="main"> (skip-link target), sections 40–48px apart, then the legal footer
 * centered (§8.10).
 */
export function LandingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-page pb-6 md:px-6 md:pb-12">
      <main id="main" tabIndex={-1} className="flex min-w-0 flex-col gap-10 outline-none md:gap-12">
        {children}
      </main>
      <LegalFooter align="center" className="mt-10 md:mt-12" />
    </div>
  );
}
