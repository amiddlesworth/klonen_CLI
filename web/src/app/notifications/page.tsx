import type { Metadata } from "next";
import { CarouselTracker } from "@/components/feed/CarouselTracker";
import { MiniProfile } from "@/components/feed/MiniProfile";
import { PeopleYouMayKnow } from "@/components/feed/PeopleYouMayKnow";
import { MarkNotificationsSeen } from "@/components/messaging/MarkNotificationsSeen";
import { NotificationsCard } from "@/components/messaging/NotificationsCard";
import { SignInNotice } from "@/components/messaging/SignInNotice";
import { SingleColumnLayout, ThreeColumnLayout } from "@/components/shell/Layouts";
import { getViewer } from "@/components/shell/viewer";
import { availabilityStatus } from "@/lib/format";
import { readNotificationsSeenAt } from "@/lib/notifications-seen";
import { getCarouselTracker, getFeedViewer, getMiniProfileStats, getPeopleYouMayKnow } from "@/lib/queries/feedx";
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

/**
 * /notifications (§8.16): the session user's notifications, grouped Today and Earlier. Needs a demo
 * session. A nav destination, so it sits on the feed's grid (audit X21): the mini profile on the left
 * (lg), the notifications card in the centre column, and the carousel tracker and people you may know
 * on the right (md and up; phone shows the card alone). Opening the page clears the Notifications
 * badge for this browser (MarkNotificationsSeen); rows stay unread-styled until clicked.
 */
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
  const feedViewer = await getFeedViewer(session);
  const [items, seenAt, shellViewer, stats, pymk, tracker] = await Promise.all([
    listNotifications(session.user.id, session.person?.id ?? null),
    readNotificationsSeenAt(),
    getViewer(session),
    getMiniProfileStats(feedViewer).catch(() => null),
    getPeopleYouMayKnow(feedViewer).catch(() => []),
    getCarouselTracker(feedViewer).catch(() => null),
  ]);
  const hasNew = items.some((n) => !n.read && (!seenAt || n.createdAt > seenAt));
  const status = shellViewer.availability ? availabilityStatus(shellViewer.availability.open, shellViewer.availability.audience, shellViewer.orgShortName) : null;
  return (
    <ThreeColumnLayout
      left={<MiniProfile viewer={feedViewer} stats={stats} status={status} />}
      right={
        <>
          {tracker && <CarouselTracker tracker={tracker} />}
          <PeopleYouMayKnow rows={pymk} />
        </>
      }
      rightLabel="Carousel and suggestions"
      hideRightOnPhone
    >
      <MarkNotificationsSeen hasNew={hasNew} />
      <NotificationsCard
        items={items}
        filter={filter}
        role={session.user.kind === "employer" ? "employer" : "coach"}
        profileSlug={session.person?.slug ?? null}
        viewerOrg={session.org ? { id: session.org.id, shortName: session.org.shortName } : null}
        isDemo={session.user.isDemo}
      />
    </ThreeColumnLayout>
  );
}
