import { FRAME_PAGE_CLASS } from "@/components/messaging/MessagingFrame";
import { MessagingSkeleton } from "@/components/messaging/MessagingSkeleton";
import { PageContainer } from "@/components/shell/Layouts";

/** Messaging skeleton: the same page frame, card and split as the page (the inbox only on phone). */
export default function MessagingLoading() {
  return (
    <PageContainer className={FRAME_PAGE_CLASS}>
      <MessagingSkeleton />
    </PageContainer>
  );
}
