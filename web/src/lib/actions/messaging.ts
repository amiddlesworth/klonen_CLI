"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, desc, eq, gt, inArray, isNull, like, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { messages, notifications, users } from "@/db/schema";
import { MAX_MESSAGE_LENGTH } from "@/components/messaging/limits";
import { ensureDemoScope, readDemoScope, scopedThreadId, SCOPE_SEP } from "@/lib/demo-scope";
import { notificationKinds, otherUserIn, type NotificationFilter } from "@/lib/queries/messaging";
import { NOTIFICATIONS_SEEN_COOKIE, NOTIFICATIONS_SEEN_MAX_AGE } from "@/lib/notifications-seen";
import { cookieOptions, getSession } from "@/lib/session";

const SIGNED_OUT = "Pick a demo account in the Me menu to use messaging.";

export type SendMessageResult = { ok: true; id: number } | { ok: false; error: string };

/**
 * A conversation id as the client names it: the base "{a}:{b}" pair, never a stored per-browser id
 * ("{a}:{b}#{scope}"). The server adds this browser's own scope itself.
 */
const ThreadId = z
  .string()
  .min(3)
  .max(200)
  .refine((v) => !v.includes(SCOPE_SEP), "This conversation isn't available.");

const SendInput = z.object({
  threadId: ThreadId,
  body: z.string().transform((s) => s.trim()).pipe(z.string().min(1, "Write a message first.").max(MAX_MESSAGE_LENGTH, `Keep messages under ${MAX_MESSAGE_LENGTH} characters.`)),
});

/** Demo accounts: at most this many messages per browser (demo scope) in RATE_WINDOW_MS. */
const RATE_LIMIT = 20;
/**
 * And at most this many from all browsers together in RATE_WINDOW_MS. The per-browser limit is keyed
 * on a cookie the client can drop (and get a fresh allowance), so this server-side cap bounds writes.
 */
const GLOBAL_RATE_LIMIT = 300;
const RATE_WINDOW_MS = 10 * 60_000;
/** Messages a browser wrote from a demo account are deleted after this long. */
const DEMO_MESSAGE_TTL_MS = 7 * 24 * 60 * 60_000;

/** The other participant of a base thread id, when it is the viewer's and that account exists. */
async function threadPartner(threadId: string, viewerUserId: string): Promise<string | null> {
  const otherId = otherUserIn(threadId, viewerUserId);
  if (!otherId) return null;
  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.id, otherId)).limit(1);
  return other ? other.id : null;
}

/** The stored thread ids this browser may touch for a base thread: the shared one and its own scoped copy. */
async function ownThreadIds(threadId: string): Promise<string[]> {
  const scope = await readDemoScope();
  return scope ? [threadId, scopedThreadId(threadId, scope)] : [threadId];
}

/**
 * Sends a message in one of the session user's conversations. Messages written from a demo account
 * are demo records (isDemo), like the conversations they answer, and stay private to the browser that
 * wrote them (lib/queries/messaging.ts "demo message scope"): the coach demo is a real coach, so
 * nothing a visitor types is shown to anyone else under that name. They are saved as read so they
 * never move another visitor's unread badge, are rate limited, and expire after a week.
 */
export async function sendMessage(input: z.input<typeof SendInput>): Promise<SendMessageResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIGNED_OUT };
  const parsed = SendInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "This message couldn't be sent." };
  const { threadId, body } = parsed.data;
  const me = session.user.id;

  try {
    const otherId = await threadPartner(threadId, me);
    if (!otherId) return { ok: false, error: "This conversation isn't available." };
    const demo = session.user.isDemo;
    let storedThreadId = threadId;
    if (demo) {
      // The demo answers its sample conversations; it never opens new ones (messaging page: "Starting
      // new conversations isn't part of the demo"). A conversation exists when it has a seeded row.
      const [seeded] = await db.select({ id: messages.id }).from(messages).where(eq(messages.threadId, threadId)).limit(1);
      if (!seeded) return { ok: false, error: "This conversation isn't available." };
      const scope = await ensureDemoScope();
      storedThreadId = scopedThreadId(threadId, scope);
      const since = new Date(Date.now() - RATE_WINDOW_MS);
      const [[recent], [everyone]] = await Promise.all([
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(like(messages.threadId, `%${SCOPE_SEP}${scope}`), gt(messages.sentAt, since))),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(like(messages.threadId, `%${SCOPE_SEP}%`), gt(messages.sentAt, since))),
      ]);
      if ((recent?.n ?? 0) >= RATE_LIMIT || (everyone?.n ?? 0) >= GLOBAL_RATE_LIMIT) {
        return { ok: false, error: "That's a lot of messages for a demo. Wait a few minutes and try again." };
      }
      await db.delete(messages).where(and(like(messages.threadId, `%${SCOPE_SEP}%`), lt(messages.sentAt, new Date(Date.now() - DEMO_MESSAGE_TTL_MS))));
    }
    const [row] = await db
      .insert(messages)
      .values({ threadId: storedThreadId, fromUserId: me, toUserId: otherId, body, isDemo: demo, readAt: demo ? new Date() : null })
      .returning({ id: messages.id });
    revalidatePath("/messaging");
    return { ok: true, id: row.id };
  } catch {
    return { ok: false, error: "Your message wasn't sent. Try again." };
  }
}

/**
 * Marks every message the session user received in a thread as read (and refreshes the nav badges).
 * Only the shared thread and this browser's own scoped copy are touched.
 */
export async function markThreadRead(rawThreadId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  const parsed = ThreadId.safeParse(rawThreadId);
  if (!session || !parsed.success) return { ok: false };
  const threadId = parsed.data;
  try {
    if (!(await threadPartner(threadId, session.user.id))) return { ok: false };
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(inArray(messages.threadId, await ownThreadIds(threadId)), eq(messages.toUserId, session.user.id), isNull(messages.readAt)));
  } catch {
    return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Marks the latest message the session user received in a thread as unread again. Only the shared
 * thread and this browser's own scoped copy are considered, so no other browser's badge moves.
 */
export async function markThreadUnread(rawThreadId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  const parsed = ThreadId.safeParse(rawThreadId);
  if (!session || !parsed.success) return { ok: false };
  const threadId = parsed.data;
  try {
    if (!(await threadPartner(threadId, session.user.id))) return { ok: false };
    const [latest] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(inArray(messages.threadId, await ownThreadIds(threadId)), eq(messages.toUserId, session.user.id)))
      .orderBy(desc(messages.sentAt), desc(messages.id))
      .limit(1);
    if (!latest) return { ok: false };
    await db.update(messages).set({ readAt: null }).where(eq(messages.id, latest.id));
  } catch {
    return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const NotificationRead = z.object({ id: z.number().int().positive().max(2_147_483_647), read: z.boolean() });

/** Marks one of the session user's notifications read or unread. */
export async function setNotificationRead(id: number, read: boolean): Promise<{ ok: boolean }> {
  const session = await getSession();
  const parsed = NotificationRead.safeParse({ id, read });
  if (!session || !parsed.success) return { ok: false };
  try {
    await db
      .update(notifications)
      .set({ readAt: parsed.data.read ? new Date() : null })
      .where(and(eq(notifications.id, parsed.data.id), eq(notifications.userId, session.user.id)));
  } catch {
    return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const Filter = z.enum(["all", "moves", "jobs", "mentions"]).default("all");

/**
 * Marks the session user's notifications read: all of them, or only those the given filter shows
 * ("Mark all as read" under Moves marks the moves).
 */
export async function markAllNotificationsRead(filter: NotificationFilter = "all"): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIGNED_OUT };
  const parsed = Filter.safeParse(filter);
  if (!parsed.success) return { ok: false, error: "We couldn't mark your notifications as read. Try again." };
  const kinds = notificationKinds(parsed.data);
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt), kinds ? inArray(notifications.kind, kinds) : undefined));
  } catch {
    return { ok: false, error: "We couldn't mark your notifications as read. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * The viewer opened /notifications: remember it for this browser (lib/notifications-seen.ts), which
 * clears the Notifications badge. Setting the cookie re-renders the current page and its layouts, so
 * the nav badge updates at once. The rows' read state is untouched.
 */
export async function markNotificationsSeen(): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  (await cookies()).set(NOTIFICATIONS_SEEN_COOKIE, new Date().toISOString(), cookieOptions(NOTIFICATIONS_SEEN_MAX_AGE));
  return { ok: true };
}
