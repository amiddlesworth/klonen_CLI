import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, House, Lock } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { getViewer } from "@/components/shell/viewer";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { availabilityStatus } from "@/lib/format";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

/**
 * Placeholder: the feed feature replaces this page. The feed is for signed-in viewers; visitors go
 * to the landing page. The left rail is a placeholder too, laid out as the §8.5 MiniProfile (avatar
 * 48 above the name, title, program row with OrgMark 24); the feed adds the demo key-values. At 721–1080px the left rail is hidden: the feed puts its MiniProfile
 * key-values into the Me menu with <MeMenuSummary> (components/shell/MeMenuSummary.tsx, §8.2); the
 * Me menu already shows the Open to opportunities status.
 */
export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const viewer = await getViewer(session);
  const status = viewer.availability ? availabilityStatus(viewer.availability.open, viewer.availability.audience, viewer.orgShortName) : null;

  const org = session.org;
  const profileHref = viewer.profileSlug ? `/in/${viewer.profileSlug}` : null;
  const left = (
    <Card padding="rail">
      <Avatar name={viewer.name} tintKey={viewer.tintKey} size={48} />
      <p className="mt-3 text-subtitle leading-5 font-semibold">
        {profileHref ? (
          <Link href={profileHref} className="target-24 rounded-xs underline-offset-2 hover:underline">
            {viewer.name}
          </Link>
        ) : (
          viewer.name
        )}
      </p>
      {viewer.title && <p className="mt-0.5 text-small text-fg-2">{viewer.title}</p>}
      {org && (
        <p className="mt-2 flex items-center gap-2 text-caption text-fg-2">
          <OrgMark shortName={org.shortName} name={org.name} size={24} />
          <span className="min-w-0">{org.name}</span>
        </p>
      )}
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
