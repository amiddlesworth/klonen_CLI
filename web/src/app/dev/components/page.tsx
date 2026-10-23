import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/shell/Layouts";
import { MeMenuSummary } from "@/components/shell/MeMenuSummary";
import { getDemoAccounts } from "@/lib/queries/shell";
import { Specimens } from "./Specimens";

export const metadata: Metadata = { title: "Components", robots: { index: false, follow: false } };

/** The gallery is a development tool: production builds answer 404. */
function devOnly() {
  if (process.env.NODE_ENV === "production") notFound();
}

/**
 * Gallery of every primitive, data component and shell piece, in light and dark (for builders and
 * reviewers). Development only. The shell previews use a fictional sample viewer, never a live demo
 * session: the coach demo is a real coach, and the Me menu would show that account's private
 * "Open to opportunities" setting to anyone who opened this page.
 */
export default async function ComponentsPage() {
  devOnly();
  const accounts = await getDemoAccounts().catch(() => []);
  const viewer = null;
  return (
    <PageContainer>
      {/* Sample for the tablet Me menu slot (§8.2): open "Me" at 721–1080px to see it. */}
      <MeMenuSummary>
        <div role="none" className="px-2 py-1.5">
          <div className="flex items-baseline justify-between text-small">
            <span className="text-fg-2">Profile viewers</span>
            <span className="num font-semibold">38</span>
          </div>
          <div className="flex items-baseline justify-between text-small">
            <span className="text-fg-2">Search appearances</span>
            <span className="num font-semibold">112</span>
          </div>
          <p className="text-caption text-fg-3">Past 7 days · demo data (gallery sample)</p>
        </div>
      </MeMenuSummary>
      <header className="max-md:px-4 max-md:pt-4">
        <h1 className="text-display max-md:text-display-sm">Components</h1>
        <p className="mt-1 max-w-prose text-small text-fg-2">
          The UI foundation from docs/DESIGN.md: tokens, primitives (components/ui), data display (components/data) and the shell (components/shell). Forced states
          use <code className="text-caption">data-force</code>. People in samples are fictional, including the viewer in the shell previews.
        </p>
      </header>
      <div data-theme="light" className="bg-transparent">
        <Specimens prefix="light" accounts={accounts} viewer={viewer} />
      </div>
      <section aria-labelledby="dark-title" className="mt-6">
        <h2 id="dark-title" className="mb-3 text-title max-md:px-4">
          Dark theme
        </h2>
        <div data-theme="dark" className="rounded-lg p-0 md:p-6">
          <Specimens prefix="dark" accounts={accounts} viewer={viewer} />
        </div>
      </section>
    </PageContainer>
  );
}
