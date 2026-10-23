import { MessagingSkeleton } from "@/components/messaging/MessagingSkeleton";
import { PageContainer } from "@/components/shell/Layouts";

/** Messaging skeleton: the same card and split as the page (the inbox only on phone). */
export default function MessagingLoading() {
  return (
    <PageContainer>
      <MessagingSkeleton />
    </PageContainer>
  );
}
