import { Lock } from "lucide-react";
import type { DemoAccountOption } from "@/components/shell/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SwitchToEmployerButton } from "./SwitchToEmployerButton";

type PipelineGateProps = {
  /** The signed-in coach's name, or null when signed out. */
  viewerName: string | null;
  /** The athletic director demo account ("Morgan Ellis", "Pacific (OR)"). */
  account: DemoAccountOption | null;
};

/**
 * Shown on /employers/pipeline to anyone but the athletic director demo account: what the page is
 * for, and the one action that opens it (the demo switcher's athletic director choice).
 */
export function PipelineGate({ viewerName, account }: PipelineGateProps) {
  const who = account ? (account.org ? `${account.name} of ${account.org}` : account.name) : null;
  const tryIt = who ? `Switch to the demo athletic director, ${who}, to try it.` : "Switch to the athletic director demo account to try it.";
  const description = viewerName
    ? `You're viewing as ${viewerName}, a coach. Athletic directors track shortlisted coaches here, from Sourced to Offer. ${tryIt}`
    : `Athletic directors track shortlisted coaches here, from Sourced to Offer. ${tryIt}`;
  return (
    <Card padding="main" aria-labelledby="pipeline-title">
      <CardHeader as="h1" id="pipeline-title" title="Hiring pipeline" />
      <EmptyState
        as="h2"
        icon={Lock}
        title="The hiring pipeline is for athletic directors."
        description={description}
        action={<SwitchToEmployerButton account={account} />}
        spacing="lg"
      />
    </Card>
  );
}
