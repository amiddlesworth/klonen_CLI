import { NotificationsSkeleton } from "@/components/messaging/NotificationsSkeleton";
import { ThreeColumnLayout } from "@/components/shell/Layouts";
import { Card } from "@/components/ui/Card";
import { SkeletonAvatar, SkeletonLine, SkeletonRows, SkeletonText } from "@/components/ui/Skeleton";

/** Notifications skeleton: the same feed grid as the page, rail cards with real titles, and the card. */
export default function NotificationsLoading() {
  return (
    <ThreeColumnLayout
      left={
        <Card padding="rail">
          <SkeletonAvatar size={48} />
          <SkeletonText className="mt-3" lines={3} widths={["70%", "90%", "60%"]} />
        </Card>
      }
      right={
        <Card padding="rail">
          <h2 className="text-body font-semibold">People you may know</h2>
          <SkeletonLine width="70%" lineHeight={16} />
          <SkeletonRows rows={3} avatar={36} className="mt-3" />
        </Card>
      }
      rightLabel="Carousel and suggestions"
      hideRightOnPhone
    >
      <NotificationsSkeleton />
    </ThreeColumnLayout>
  );
}
