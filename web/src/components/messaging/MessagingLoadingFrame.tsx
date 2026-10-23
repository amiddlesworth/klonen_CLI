"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/shell/Layouts";
import { cn } from "@/lib/cn";
import { FRAME_PAGE_CLASS, FRAME_PAGE_THREAD_CLASS } from "./MessagingFrame";
import { MessagingSkeleton } from "./MessagingSkeleton";

function Frame({ thread }: { thread: boolean }) {
  return (
    <PageContainer footer={!thread} className={cn(FRAME_PAGE_CLASS, thread && FRAME_PAGE_THREAD_CLASS)}>
      <MessagingSkeleton phone={thread ? "thread" : "inbox"} />
    </PageContainer>
  );
}

function FromUrl() {
  const params = useSearchParams();
  return <Frame thread={params.has("thread") || params.has("to")} />;
}

/**
 * The /messaging loading state in the page's own frame. It reads the URL being loaded so the phone
 * skeleton matches what arrives (§8.0): a conversation page (?thread=, ?to=) gets the thread shape
 * with no legal footer, so opening a thread doesn't flash inbox rows and a footer first.
 */
export function MessagingLoadingFrame() {
  return (
    <Suspense fallback={<Frame thread={false} />}>
      <FromUrl />
    </Suspense>
  );
}
