import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MessageSquare } from "lucide-react";
import { InboxList } from "@/components/messaging/InboxList";
import { MarkThreadRead } from "@/components/messaging/MarkThreadRead";
import { MessagingCard, ThreadPane, InboxPane } from "@/components/messaging/MessagingFrame";
import { SignInNotice } from "@/components/messaging/SignInNotice";
import { ThreadHeader, ThreadIntro } from "@/components/messaging/ThreadHeader";
import { ThreadView } from "@/components/messaging/ThreadView";
import { PageContainer } from "@/components/shell/Layouts";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getThread, listThreads } from "@/lib/queries/messaging";
import { getDemoAccounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";

type Props = { searchParams: Promise<{ thread?: string | string[] }> };

const loadThread = cache(getThread);

const DESCRIPTION = "Conversations with coaches and athletic directors.";
const PRIVATE = { robots: { index: false, follow: false } } satisfies Metadata;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { thread } = await searchParams;
  const session = await getSession();
  if (!session || typeof thread !== "string") return { title: "Messaging", description: DESCRIPTION, ...PRIVATE };
  const t = await loadThread(session.user.id, thread).catch(() => null);
  return { title: t ? `${t.other.name} · Messaging` : "Messaging", description: DESCRIPTION, ...PRIVATE };
}

/**
 * /messaging (§8.15). Desktop: the inbox (320) and the open thread in one card. Phone: the inbox,
 * and each thread on its own page (?thread=) with a back button. Needs a demo session.
 */
export default async function MessagingPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) {
    const accounts = await getDemoAccounts().catch(() => []);
    return (
      <PageContainer className="max-w-[640px] md:box-content">
        <SignInNotice
          title="Messaging"
          icon="messaging"
          message="Sign in to see your messages."
          description="Messages are private to an account. Pick a demo account to read and answer its sample conversations."
          accounts={accounts}
        />
      </PageContainer>
    );
  }

  const { thread: param } = await searchParams;
  const requested = typeof param === "string" && param ? param : null;
  const threads = await listThreads(session.user.id);

  if (!threads.length && !requested) {
    return (
      <PageContainer className="max-w-[640px] md:box-content">
        <Card padding="main">
          <CardHeader as="h1" title="Messaging" />
          <EmptyState icon={MessageSquare} title="No messages yet." description="Messages from coaches and employers show up here." spacing="lg" />
        </Card>
      </PageContainer>
    );
  }

  const selectedId = requested ?? threads[0].id;
  const thread = await loadThread(session.user.id, selectedId);
  if (!thread) notFound();

  const explicit = requested !== null;
  const unreadTotal = threads.reduce((n, t) => n + t.unread, 0);
  const me = {
    userId: session.user.id,
    name: session.user.name,
    tintKey: session.person?.slug ?? session.user.id,
    profileSlug: session.person?.slug ?? null,
  };
  const other = { userId: thread.other.userId, name: thread.other.name, tintKey: thread.other.tintKey, profileSlug: thread.other.profileSlug };

  return (
    <PageContainer>
      <MessagingCard>
        <InboxPane hiddenOnPhone={explicit} unread={unreadTotal}>
          <InboxList threads={threads} selectedId={thread.id} explicit={explicit} now={new Date()} />
        </InboxPane>
        <ThreadPane hiddenOnPhone={!explicit} label={`Conversation with ${thread.other.name}`}>
          {/* The page's h1 on the phone thread page, where the inbox (and its h1) is hidden. */}
          {explicit && <h1 className="sr-only md:hidden">Messaging: conversation with {thread.other.name}</h1>}
          <MarkThreadRead key={`${thread.id}:${explicit}`} threadId={thread.id} unread={thread.unread} />
          <ThreadHeader threadId={thread.id} other={thread.other} isDemo={thread.isDemo} />
          <ThreadView
            key={thread.id}
            threadId={thread.id}
            me={me}
            other={other}
            messages={thread.messages.map((m) => ({ id: m.id, fromUserId: m.fromUserId, body: m.body, sentAt: m.sentAt.toISOString() }))}
            scrollPageOnPhone={explicit}
            intro={<ThreadIntro other={thread.other} isDemo={thread.isDemo} />}
          />
        </ThreadPane>
      </MessagingCard>
    </PageContainer>
  );
}
