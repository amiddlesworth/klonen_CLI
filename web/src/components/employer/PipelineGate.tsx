import { Lock } from "lucide-react";
import type { DemoAccountOption } from "@/components/shell/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { PipelineFrame } from "./PipelineFrame";
import { SwitchToEmployerButton } from "./SwitchToEmployerButton";

type PipelineGateProps = {
  /** The athletic director demo account ("Morgan Ellis", "Pacific (OR)"). */
  account: DemoAccountOption | null;
};

/**
 * Shown on /employers/pipeline to anyone but the athletic director demo account (§8.0 Empty): one
 * sentence on who the page is for, one line on how to try it, and one secondary button (the demo
 * switcher's athletic director choice).
 */
export function PipelineGate({ account }: PipelineGateProps) {
  const who = account ? (account.org ? `${account.name} of ${account.org}` : account.name) : null;
  return (
    <PipelineFrame>
      <EmptyState
        as="h2"
        icon={Lock}
        title="The hiring pipeline is for athletic directors."
        description={who ? `Switch to the demo athletic director, ${who}, to try it.` : "Switch to the athletic director demo account to try it."}
        action={<SwitchToEmployerButton account={account} />}
        spacing="lg"
      />
    </PipelineFrame>
  );
}
