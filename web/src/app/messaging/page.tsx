import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { MessageSquare, MessageSquarePlus } from "lucide-react";
import { InboxList } from "@/components/messaging/InboxList";
import { MarkThreadRead } from "@/components/messaging/MarkThreadRead";
import { FRAME_PAGE_CLASS, FRAME_PAGE_THREAD_CLASS, InboxPane, MessagingCard, ThreadPane } from "@/components/messaging/MessagingFrame";
import { SignInNotice } from "@/components/messaging/SignInNotice";
import { DemoNote, ThreadHeader } from "@/components/messaging/ThreadHeader";
import { ThreadView } from "@/components/messaging/ThreadView";
import { threadHref } from "@/components/messaging/format";
import { PageContainer, SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { getComposeTarget, getThread, listThreads, readDemoScope, threadIdFor } from "@/lib/queries/messaging";
import { getDemoAccounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";

type Props = { searchParams: Promise<{ thread?: string | string[]; to?: string | string[] }> };

const loadThread = cache(getThread);
const loadTarget = cache(getComposeTarget);

const DESCRIPTION = "Conversations with coaches and athletic directors.";
const PRIVATE = { robots: { index: false, follow: false } } satisfies Metadata;

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const thread = one(params.thread);
  const to = one(params.to);
  const session = await getSession();
  if (session && thread) {
    const t = await loadThread(session.user.id, thread, await readDemoScope()).catch(() => null);
    if (t) return { title: `${t.other.name} · Messaging`, description: DESCRIPTION, ...PRIVATE };
  } else if (session && to && to !== session.person?.slug) {
    const target = await loadTarget(to).catch(() => null);
    if (target) return { title: `New message to ${target.name} · Messaging`, description: DESCRIPTION, ...PRIVATE };
  }
  return { title: "Messaging", description: DESCRIPTION, ...PRIVATE };
}

/**
 * /messaging (§8.15). Desktop: the inbox (320) and the open thread in one card that fills the
 * viewport. Phone: the inbox, and each thread on its own page (?thread=) with a back link.
 * ?to={slug} (the Message buttons on profiles and the feed) opens the conversation with that person,
 * or, when there is none, their header and a note that starting conversations isn't in the demo.
 * Needs a demo session.
 */
export default async function MessagingPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) {
    const accounts = await getDemoAccounts().catch(() => []);
    return (
      <SingleColumnLayout>
        <SignInNotice
          title="Messaging"
          icon="messaging"
          message="Sign in to see your messages."
          description="Messages are private to an account. Pick a demo account to read and answer its sample conversations."
          accounts={accounts}
        />
      </SingleColumnLayout>
    );
  }

  const params = await searchParams;
  const requested = one(params.thread);
  const scope = await readDemoScope();
  const threads = await listThreads(session.user.id, scope);

  // ?to={slug}: the existing conversation with that person, else a new-message pane.
  const to = requested ? null : one(params.to);
  const target = to ? await loadTarget(to) : null;
  const composing = target && target.profileSlug !== (session.person?.slug ?? null) ? target : null;
  if (composing?.userId) {
    const existing = threadIdFor(session.user.id, composing.userId);
    if (threads.some((t) => t.id === existing)) redirect(threadHref(existing));
  }

  if (!threads.length && !requested && !composing) {
    return (
      <SingleColumnLayout>
        <Card padding="main">
          <CardHeader as="h1" title="Messaging" />
          <EmptyState icon={MessageSquare} title="No messages yet." description="Messages from coaches and employers show up here." spacing="lg" />
        </Card>
      </SingleColumnLayout>
    );
  }

  const unreadTotal = threads.reduce((n, t) => n + t.unread, 0);

  if (composing) {
    return (
      <PageContainer footer={false} className={cn(FRAME_PAGE_CLASS, FRAME_PAGE_THREAD_CLASS)}>
        <MessagingCard>
          <InboxPane hiddenOnPhone unread={unreadTotal}>
            <InboxList threads={threads} selectedId={null} explicit now={new Date()} />
          </InboxPane>
          <ThreadPane threadId={null} hiddenOnPhone={false} fillOnPhone label={`New message to ${composing.name}`}>
            <h1 className="sr-only md:hidden">Messaging: new message to {composing.name}</h1>
            <ThreadHeader threadId={null} other={composing} isDemo={composing.isDemo} />
            <div className="flex flex-1 flex-col justify-center px-4 md:px-6">
              <EmptyState
                icon={MessageSquarePlus}
                title="Starting new conversations isn't part of the demo."
                description={`The demo lets you read and answer the sample conversations in your inbox. ${composing.firstName}'s profile has the full coaching record.`}
                action={
                  composing.profileSlug ? (
                    <ButtonLink href={`/in/${composing.profileSlug}`} variant="secondary">
                      View profile
                    </ButtonLink>
                  ) : undefined
                }
                spacing="lg"
              />
            </div>
          </ThreadPane>
        </MessagingCard>
      </PageContainer>
    );
  }

  const selectedId = requested ?? threads[0].id;
  const thread = await loadThread(session.user.id, selectedId, scope);
  if (!thread) notFound();

  const explicit = requested !== null;
  const me = {
    userId: session.user.id,
    name: session.user.name,
    tintKey: session.person?.slug ?? session.user.id,
    profileSlug: session.person?.slug ?? null,
  };
  const other = { userId: thread.other.userId, name: thread.other.name, tintKey: thread.other.tintKey, profileSlug: thread.other.profileSlug };

  return (
    <PageContainer footer={!explicit} className={cn(FRAME_PAGE_CLASS, explicit && FRAME_PAGE_THREAD_CLASS)}>
      <MessagingCard selectedId={thread.id}>
        <InboxPane hiddenOnPhone={explicit} unread={unreadTotal}>
          <InboxList threads={threads} selectedId={thread.id} explicit={explicit} now={new Date()} />
        </InboxPane>
        <ThreadPane threadId={thread.id} hiddenOnPhone={!explicit} fillOnPhone={explicit} label={`Conversation with ${thread.other.name}`}>
          {/* The page's h1 on the phone thread page, where the inbox (and its h1) is hidden. */}
          {explicit && <h1 className="sr-only md:hidden">Messaging: conversation with {thread.other.name}</h1>}
          <MarkThreadRead key={`${thread.id}:${explicit}`} threadId={thread.id} unread={thread.unread} explicit={explicit} />
          <ThreadHeader threadId={thread.id} other={thread.other} isDemo={thread.isDemo} />
          <ThreadView
            key={thread.id}
            threadId={thread.id}
            me={me}
            other={other}
            messages={thread.messages.map((m) => ({ id: m.id, fromUserId: m.fromUserId, body: m.body, sentAt: m.sentAt.toISOString() }))}
            scrollPageOnPhone={explicit}
            intro={thread.isDemo ? <DemoNote other={thread.other} /> : undefined}
          />
        </ThreadPane>
      </MessagingCard>
    </PageContainer>
  );
}
