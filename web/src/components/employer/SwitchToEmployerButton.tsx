"use client";
import { ArrowLeftRight } from "lucide-react";
import { useDemoSwitch } from "@/components/shell/DemoSwitcher";
import type { DemoAccountOption } from "@/components/shell/types";
import { Button } from "@/components/ui/Button";

/** Switches to the athletic director demo account and stays on this page (the demo switcher's action). */
export function SwitchToEmployerButton({ account }: { account: DemoAccountOption | null }) {
  const { switchTo, pending } = useDemoSwitch();
  return (
    <Button variant="primary" icon={ArrowLeftRight} phone="large" loading={pending} onClick={() => switchTo("employer", account ?? undefined)}>
      Switch to athletic director
    </Button>
  );
}
