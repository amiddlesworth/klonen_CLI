import type { Metadata } from "next";
import { NotificationsCard } from "@/components/messaging/NotificationsCard";
import { SignInNotice } from "@/components/messaging/SignInNotice";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { listNotifications, type NotificationFilter } from "@/lib/queries/messaging";
import { getDemoAccounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";

type Props = { searchParams: Promise<{ filter?: string | string[] }> };

const FILTERS: NotificationFilter[] = ["all", "moves", "jobs", "mentions"];
const LABEL: Record<NotificationFilter, string> = { all: "Notifications", moves: "Moves · Notifications", jobs: "Jobs · Notifications", mentions: "Mentions · Notifications" };

function parseFilter(v: string | string[] | undefined): NotificationFilter {
  return typeof v === "string" && (FILTERS as string[]).includes(v) ? (v as NotificationFilter) : "all";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filter = parseFilter((await searchParams).filter);
  return {
    title: LABEL[filter],
    description: "Your notifications: moves, jobs, mentions and profile views.",
    robots: { index: false, follow: false },
  };
}

/** /notifications (§8.16): the session user's notifications, grouped Today and Earlier. Needs a demo session. */
export default async function NotificationsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) {
    const accounts = await getDemoAccounts().catch(() => []);
    return (
      <SingleColumnLayout>
        <SignInNotice
          title="Notifications"
          icon="notifications"
          message="Sign in to see your notifications."
          description="Notifications are private to an account: moves in your coaching tree, job matches and profile views. Pick a demo account to see its sample notifications."
          accounts={accounts}
        />
      </SingleColumnLayout>
    );
  }
  const filter = parseFilter((await searchParams).filter);
  const items = await listNotifications(session.user.id, session.person?.id ?? null);
  return (
    <SingleColumnLayout>
      <NotificationsCard
        items={items}
        filter={filter}
        role={session.user.kind === "employer" ? "employer" : "coach"}
        profileSlug={session.person?.slug ?? null}
        viewerOrg={session.org ? { id: session.org.id, shortName: session.org.shortName } : null}
        isDemo={session.user.isDemo}
      />
    </SingleColumnLayout>
  );
}
