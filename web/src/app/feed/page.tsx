import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, House, Lock } from "lucide-react";
import { PersonRow } from "@/components/data/PersonRow";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { getViewer } from "@/components/shell/viewer";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { availabilityStatus } from "@/lib/format";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

/**
 * Placeholder: the feed feature replaces this page. The feed is for signed-in viewers; visitors go
 * to the landing page. At 721–1080px the left rail is hidden: the feed puts its MiniProfile
 * key-values into the Me menu with <MeMenuSummary> (components/shell/MeMenuSummary.tsx, §8.2); the
 * Me menu already shows the Open to opportunities status.
 */
export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const viewer = await getViewer(session);
  const status = viewer.availability ? availabilityStatus(viewer.availability.open, viewer.availability.audience, viewer.orgShortName) : null;

  const left = (
    <Card padding="rail">
      <PersonRow
        name={viewer.name}
        tintKey={viewer.tintKey}
        href={viewer.profileSlug ? `/in/${viewer.profileSlug}` : null}
        title={viewer.title}
        org={viewer.orgShortName}
        avatarSize={48}
        truncate={false}
      />
      {status && (
        <Link href="/settings/availability" className="group -mx-4 -mb-4 mt-3 flex items-center gap-2 border-t border-divider px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-small font-medium group-hover:underline underline-offset-2">Open to opportunities</span>
            <span className="flex items-center gap-1 text-caption text-fg-3">
              <Icon icon={Lock} size={12} className="text-fg-2" />
              {status}
            </span>
          </span>
          <Icon icon={ChevronRight} size={16} className="text-fg-3" />
        </Link>
      )}
    </Card>
  );

  return (
    <PlaceholderPage
      layout="three"
      left={left}
      title="Home"
      icon={House}
      message="Your feed is on its way."
      description="Hires, promotions, jobs and milestones across Division III will show up here."
    />
  );
}
