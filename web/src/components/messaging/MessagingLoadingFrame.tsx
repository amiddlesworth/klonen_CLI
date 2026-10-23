"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/shell/Layouts";
import { cn } from "@/lib/cn";
import { FRAME_PAGE_CLASS, FRAME_PAGE_THREAD_CLASS } from "./classes";
import { MessagingSkeleton } from "./MessagingSkeleton";

function Frame({ phone }: { phone: "inbox" | "thread" | "neutral" }) {
  return (
    <PageContainer footer={phone === "inbox"} className={cn(FRAME_PAGE_CLASS, phone !== "inbox" && FRAME_PAGE_THREAD_CLASS)}>
      <MessagingSkeleton phone={phone} />
    </PageContainer>
  );
}

function FromUrl() {
  const params = useSearchParams();
  return <Frame phone={params.has("thread") || params.has("to") ? "thread" : "inbox"} />;
}

/**
 * The /messaging loading state in the page's own frame. It reads the URL being loaded so the phone
 * skeleton matches what arrives (§8.0): a conversation page (?thread=, ?to=) gets the thread shape
 * with no legal footer, so opening a thread doesn't flash inbox rows and a footer first. Until the URL
 * is known (the first server-rendered chunk), the phone shows a neutral card with no footer.
 */
export function MessagingLoadingFrame() {
  return (
    <Suspense fallback={<Frame phone="neutral" />}>
      <FromUrl />
    </Suspense>
  );
}
