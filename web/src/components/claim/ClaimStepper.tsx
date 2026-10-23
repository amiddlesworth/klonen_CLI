import { Stepper } from "@/components/ui/Stepper";

export const CLAIM_STEPS = ["Confirm identity", "Review your career", "Publish"] as const;

/** Claim stepper (§8.11): the shared Stepper with the three claim steps. */
export function ClaimStepper({ current, className }: { current: number; className?: string }) {
  return <Stepper steps={CLAIM_STEPS} current={current} label="Claim progress" className={className} />;
}
