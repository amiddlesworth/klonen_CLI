import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { PageContainer, SingleColumnLayout } from "@/components/shell/Layouts";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PostJobForm } from "@/components/jobs/PostJobForm";
import { SwitchToEmployer } from "@/components/jobs/SwitchToEmployer";
import { BRAND } from "@/lib/brand";
import { getEmployerOrg } from "@/lib/queries/jobsx";
import { getDemoAccounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Post a job",
  description: `Post a coaching job to ${BRAND.name}: a listing on Jobs and in the feed.`,
  robots: { index: false },
};

/**
 * Post a job (§8.13). Requires the athletic director demo session; anyone else gets an
 * explanation and a one-click switch to that account (it stays on this page).
 */
/** Wayfinding (audit X11): Post a job sits under the hiring pipeline, where a published listing lands. */
const crumb = <Breadcrumb items={[{ label: "Hiring pipeline", href: "/employers/pipeline" }]} current="Post a job" phone="back" />;

export default async function PostJobPage() {
  const session = await getSession().catch(() => null);
  const org = session?.user.kind === "employer" && session.user.orgId ? await getEmployerOrg(session.user.orgId) : null;

  if (!session || session.user.kind !== "employer" || !org) {
    const accounts = await getDemoAccounts().catch(() => []);
    const ad = accounts.find((a) => a.role === "employer");
    const who = session ? `You're viewing as ${session.user.name}, the coach demo account.` : "You're browsing signed out.";
    return (
      <SingleColumnLayout breadcrumb={crumb}>
        <Card padding="main" aria-labelledby="post-job-gate">
          {/* The same h1 scale as the form state, so the route's title doesn't jump between states. */}
          <h1 id="post-job-gate" className="text-display-sm">
            Post a job
          </h1>
          <EmptyState
            icon={Briefcase}
            title="Posting jobs uses the athletic director demo account."
            description={
              <>
                {who} Switch to {ad ? `${ad.name}${ad.org ? `, athletic director at ${ad.org},` : ""}` : "the athletic director account"} to fill in a listing, preview it
                and publish it to the demo.
              </>
            }
            action={<SwitchToEmployer account={ad} />}
            spacing="lg"
          />
        </Card>
      </SingleColumnLayout>
    );
  }

  return (
    <PageContainer breadcrumb={crumb}>
      <PostJobForm org={org} posterName={session.user.name} />
    </PageContainer>
  );
}
