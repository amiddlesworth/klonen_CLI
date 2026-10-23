import { NotificationsSkeleton } from "@/components/messaging/NotificationsSkeleton";
import { SingleColumnLayout } from "@/components/shell/Layouts";

/** Notifications skeleton: the same single column and card as the page. */
export default function NotificationsLoading() {
  return (
    <SingleColumnLayout>
      <NotificationsSkeleton />
    </SingleColumnLayout>
  );
}
