"use client";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDemoSwitch } from "@/components/shell/DemoSwitcher";
import type { DemoAccountOption } from "@/components/shell/types";

/** Switches to the athletic director demo account and stays on this page. */
export function SwitchToEmployer({ account }: { account?: DemoAccountOption }) {
  const { switchTo, pending } = useDemoSwitch();
  return (
    <Button variant="secondary" icon={Repeat} phone="large" loading={pending} onClick={() => switchTo("employer", account)}>
      {account ? `Switch to ${account.name}` : "Switch to the athletic director demo"}
    </Button>
  );
}
