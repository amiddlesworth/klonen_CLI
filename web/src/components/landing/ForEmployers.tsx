import type { ReactNode } from "react";
import { Briefcase, LayoutGrid, Network, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { startEmployerDemo } from "@/lib/actions/landing";
import type { TreeSearchExample } from "@/lib/queries/landing";
import { fmtCount } from "./copy";
import { DemoStartButton } from "./DemoStartButton";

/** A feature row: a bare 16px --fg-2 icon on the title's line, title and body on one 28px text offset. */
function Feature({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <Icon icon={icon} size={16} className="mt-0.5 text-fg-2" />
      <div className="min-w-0">
        <h3 className="text-body font-semibold">{title}</h3>
        <p className="mt-0.5 text-small text-fg-2">{children}</p>
      </div>
    </li>
  );
}

type ForEmployersProps = {
  example: TreeSearchExample | null;
  /**
   * The live "Coaches and staff" count from the proof band and how many of those records span two
   * or more programs (null when the stats failed to load).
   */
  depth: { coaches: number; multiProgram: number } | null;
  /** The athletic director demo account ("Morgan Ellis", "Pacific (OR)"), named under the buttons. */
  demoAccount: { name: string; org: string | null } | null;
};

/**
 * Employer section: a main card (standard 20/24 padding) with the pitch, two secondary actions
 * (Post a job, the athletic director demo, named in a caption like the hero's) beside three
 * features. The pitch makes no adoption claim (profiles are sourced, not yet claimed) and says how
 * deep the records go: many list only the current job. The tree search example is a real query
 * from the dataset. The demo account is fictional, so its name carries the dashed Demo chip.
 */
export function ForEmployers({ example, depth, demoAccount }: ForEmployersProps) {
  return (
    <section aria-labelledby="employers-title">
      <Card padding="main" className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
        <div className="flex flex-col">
          <h2 id="employers-title" className="text-display-sm">
            Hiring a coach?
          </h2>
          <p className="mt-2 max-w-prose text-prose text-fg-2">
            {depth ? (
              <>
                Post an opening and search sourced staff records for <span className="num">{fmtCount(depth.coaches)}</span> Division III
                coaches and staff by role, conference and coaching tree.
                {depth.multiProgram > 0 && (
                  <>
                    {" "}
                    <span className="num">{fmtCount(depth.multiProgram)}</span> of those records list stops at two or more programs.
                  </>
                )}
              </>
            ) : (
              "Post an opening and search sourced staff records for Division III coaches and staff by role, conference and coaching tree."
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 max-md:grid max-md:grid-cols-1">
            <ButtonLink href="/employers/jobs/new" phone="large">
              Post a job
            </ButtonLink>
            <DemoStartButton
              action={startEmployerDemo}
              viewAs={demoAccount?.name ?? "the athletic director demo account"}
              phone="large"
              formClassName="contents"
            >
              Try the athletic director demo
            </DemoStartButton>
          </div>
          {demoAccount && (
            <p className="mt-3 text-caption text-fg-3">
              The demo shows the employer view as{" "}
              <span className="whitespace-nowrap">
                {demoAccount.name} <SampleChip className="-my-0.5" />
              </span>
              , a fictional athletic director{demoAccount.org ? ` at ${demoAccount.org}` : ""}.
            </p>
          )}
        </div>
        <ul className="divide-y divide-divider max-lg:mt-5 max-lg:border-t max-lg:border-divider max-lg:pt-4">
          <Feature icon={Briefcase} title="Post jobs">
            Listings show on Jobs and in coaches&rsquo; feeds, first for coaches in matching positions.
          </Feature>
          <Feature icon={Network} title="Search by coaching tree">
            Filter candidates by who they worked under and where.
            {example && (
              <>
                {" "}
                <TextLink href={`/search?type=people&workedUnder=${encodeURIComponent(example.slug)}`} variant="inline">
                  Coaches who worked under {example.fullName} ({example.orgShortName})
                </TextLink>
              </>
            )}
          </Feature>
          <Feature icon={LayoutGrid} title="Track a hiring pipeline">
            Shortlist candidates from sourced to offer, with notes for your search committee.
          </Feature>
        </ul>
      </Card>
    </section>
  );
}
