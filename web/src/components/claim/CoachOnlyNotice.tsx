"use client";
import type { ReactNode } from "react";
import { Lock, UserRound } from "lucide-react";
import { useDemoSwitch } from "@/components/shell/DemoSwitcher";
import type { DemoAccountOption } from "@/components/shell/types";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";

type CoachOnlyNoticeProps = {
  /** The page's h1. */
  title: string;
  /** One 14/500 sentence stating the fact. */
  message: string;
  /** What happens next (13 --fg-2). */
  description: ReactNode;
  /** The coach demo account, so the toast can name the person. */
  coach: DemoAccountOption | null;
  icon?: "lock" | "person";
};

/**
 * A page that needs the coach demo session, shown to visitors and to the athletic director demo:
 * explains why, then offers one secondary action that switches to the coach demo (and stays here).
 */
export function CoachOnlyNotice({ title, message, description, coach, icon = "lock" }: CoachOnlyNoticeProps) {
  const { switchTo, pending } = useDemoSwitch();
  return (
    <Card padding="main">
      <CardHeader as="h1" title={title} />
      <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
        <Icon icon={icon === "lock" ? Lock : UserRound} size={20} className="mb-2 text-fg-3" />
        <p className="text-body font-medium text-fg-1">{message}</p>
        <p className="max-w-prose text-small text-fg-2">{description}</p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Button icon={UserRound} loading={pending} onClick={() => switchTo("coach", coach ?? undefined)}>
            {coach ? `Continue as ${coach.name}` : "Switch to the coach demo"}
          </Button>
          <p className="text-caption text-fg-3">
            <SampleChip label="Demo" className="mr-1.5" />
            Sign-in uses demo accounts.
          </p>
        </div>
      </div>
    </Card>
  );
}
