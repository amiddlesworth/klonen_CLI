"use client";
import { Bell, MessageSquare, UserRound } from "lucide-react";
import { useDemoSwitch } from "@/components/shell/DemoSwitcher";
import type { DemoAccountOption } from "@/components/shell/types";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";

type SignInNoticeProps = {
  /** The page's h1 ("Messaging"). */
  title: string;
  /** The page's icon (a name, since icons can't cross into a client component). */
  icon: "messaging" | "notifications";
  /** One 14/500 sentence stating the fact. */
  message: string;
  /** What happens next (13 --fg-2). */
  description: string;
  /** The demo accounts (coach first), so the button and toast can name the person. */
  accounts: DemoAccountOption[];
};

/**
 * Shown to visitors on pages that belong to an account (messaging, notifications): says why, then
 * offers the coach demo as the one button and the athletic director demo as a text alternative.
 * Switching keeps the viewer on this page.
 */
export function SignInNotice({ title, icon, message, description, accounts }: SignInNoticeProps) {
  const { switchTo, pending } = useDemoSwitch();
  const coach = accounts.find((a) => a.role === "coach");
  const ad = accounts.find((a) => a.role === "employer");
  return (
    <Card padding="main">
      <CardHeader as="h1" title={title} />
      <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
        <Icon icon={icon === "messaging" ? MessageSquare : Bell} size={20} className="mb-2 text-fg-3" />
        <p className="text-body font-medium text-fg-1">{message}</p>
        <p className="max-w-prose text-small text-fg-2">{description}</p>
        <div className="mt-4 flex flex-col items-center gap-1 md:gap-2">
          <Button icon={UserRound} loading={pending} onClick={() => switchTo("coach", coach)}>
            {coach ? `Continue as ${coach.name}` : "Continue as the coach demo"}
          </Button>
          <button
            type="button"
            disabled={pending}
            onClick={() => switchTo("employer", ad)}
            className="target-24 inline-flex items-center rounded-xs text-small font-medium text-link underline-offset-2 hover:underline disabled:text-fg-disabled max-md:min-h-11"
          >
            {ad ? `Or as ${ad.name}, athletic director` : "Or as the athletic director demo"}
          </button>
          <p className="mt-1 flex items-center gap-1.5 text-caption text-fg-3">
            <SampleChip label="Demo" />
            Sign-in uses demo accounts.
          </p>
        </div>
      </div>
    </Card>
  );
}
