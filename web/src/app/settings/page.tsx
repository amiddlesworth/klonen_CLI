import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ThemeSetting } from "@/components/shell/ThemeSetting";
import { getViewer } from "@/components/shell/viewer";
import { Card, CardHeader } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { availabilityStatus } from "@/lib/format";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

/** Settings index (the Me menu's "Settings"): Open to opportunities, theme and the demo account. */
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const viewer = await getViewer(session);
  const account = [viewer.role === "coach" ? "Coach" : "Athletic director", viewer.orgShortName].filter(Boolean).join(" · ");

  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Settings" />
        <ul className="-mb-1 divide-y divide-divider border-t border-divider">
          {viewer.availability && (
            <li>
              <Link href="/settings/availability" className="group flex min-h-14 items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium group-hover:underline underline-offset-2">Open to opportunities</span>
                  <span className="mt-0.5 flex items-center gap-1 text-caption text-fg-3">
                    <Icon icon={Lock} size={12} className="text-fg-2" />
                    {availabilityStatus(viewer.availability.open, viewer.availability.audience, viewer.orgShortName)}
                  </span>
                </span>
                <Icon icon={ChevronRight} size={16} className="text-fg-3" />
              </Link>
            </li>
          )}
          <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <span className="min-w-0">
              <span className="block text-body font-medium">Theme</span>
              <span className="mt-0.5 block text-caption text-fg-3">System follows your device</span>
            </span>
            <ThemeSetting />
          </li>
          <li className="py-3">
            <span className="flex items-center gap-2 text-body font-medium">
              Demo account <SampleChip label="Demo" />
            </span>
            <span className="mt-0.5 block text-caption text-fg-3">
              {viewer.name}
              {account && ` · ${account}`}. Switch accounts or sign out from the Me menu.
            </span>
          </li>
        </ul>
      </Card>
    </SingleColumnLayout>
  );
}
