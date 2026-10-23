import type { ReactNode } from "react";
import { Briefcase, LayoutGrid, Network, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { switchDemoAccount } from "@/lib/actions/session";
import type { TreeSearchExample } from "@/lib/queries/landing";
import { DemoSubmitButton } from "./DemoSubmitButton";

// Bound with both arguments: the form's FormData arrives third and is ignored.
const startEmployerDemo = switchDemoAccount.bind(null, "employer", "/employers/pipeline");

function Feature({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-hover text-fg-2">
        <Icon icon={icon} size={16} />
      </span>
      <div className="min-w-0">
        <h3 className="text-body font-semibold">{title}</h3>
        <p className="mt-0.5 text-small text-fg-2">{children}</p>
      </div>
    </li>
  );
}

/**
 * Employer section: a card with the pitch and two secondary actions (Post a job, the athletic
 * director demo) beside three features. The tree search example is a real query from the dataset.
 */
export function ForEmployers({ example }: { example: TreeSearchExample | null }) {
  return (
    <section aria-labelledby="employers-title">
      <Card padding="main" className="md:py-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10 lg:px-8">
        <div className="flex flex-col">
          <h2 id="employers-title" className="text-display-sm">
            Hiring a coach?
          </h2>
          <p className="mt-2 max-w-prose text-prose text-fg-2">
            Post an opening where Division III coaches already keep their records, then search staffs by role, conference and coaching tree.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 max-md:grid max-md:grid-cols-1">
            <ButtonLink href="/employers/jobs/new" icon={Briefcase} phone="large">
              Post a job
            </ButtonLink>
            <form action={startEmployerDemo} className="contents">
              <DemoSubmitButton phone="large">
                Try the athletic director demo
              </DemoSubmitButton>
            </form>
          </div>
        </div>
        <ul className="divide-y divide-divider max-lg:mt-5 max-lg:border-t max-lg:border-divider max-lg:pt-4">
          <Feature icon={Briefcase} title="Post jobs">
            Listings show on Jobs and in the feeds of coaches in matching roles.
          </Feature>
          <Feature icon={Network} title="Search by coaching tree">
            Filter candidates by who they worked under and where.
            {example && (
              <>
                {" "}
                <TextLink href={`/search?type=people&workedUnder=${encodeURIComponent(example.slug)}`} variant="inline">
                  Coaches who worked under {example.fullName}
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
