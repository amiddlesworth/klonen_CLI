"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, desc, eq, gt, inArray, isNull, like, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { messages, notifications, users } from "@/db/schema";
import { MAX_MESSAGE_LENGTH } from "@/components/messaging/limits";
import { DEMO_SCOPE_COOKIE, notificationKinds, otherUserIn, readDemoScope, scopedThreadId, type NotificationFilter } from "@/lib/queries/messaging";
import { getSession } from "@/lib/session";

const SIGNED_OUT = "Pick a demo account in the Me menu to use messaging.";

export type SendMessageResult = { ok: true; id: number } | { ok: false; error: string };

const SendInput = z.object({
  threadId: z.string().min(3).max(200),
  body: z.string().transform((s) => s.trim()).pipe(z.string().min(1, "Write a message first.").max(MAX_MESSAGE_LENGTH, `Keep messages under ${MAX_MESSAGE_LENGTH} characters.`)),
});

/** Demo accounts: at most this many messages per browser in RATE_WINDOW_MS. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60_000;
/** Messages a browser wrote from a demo account are deleted after this long. */
const DEMO_MESSAGE_TTL_MS = 7 * 24 * 60 * 60_000;

/** This browser's demo message scope, created (httpOnly cookie) on its first message. */
async function ensureDemoScope(): Promise<string> {
  const existing = await readDemoScope();
  if (existing) return existing;
  const scope = randomBytes(12).toString("hex");
  (await cookies()).set(DEMO_SCOPE_COOKIE, scope, { httpOnly: true, sameSite: "lax", path: "/", maxAge: DEMO_MESSAGE_TTL_MS / 1000 });
  return scope;
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
  const otherId = otherUserIn(threadId, me);
  if (!otherId) return { ok: false, error: "This conversation isn't available." };

  try {
    const [other] = await db.select({ id: users.id }).from(users).where(eq(users.id, otherId)).limit(1);
    if (!other) return { ok: false, error: "This conversation isn't available." };
    const demo = session.user.isDemo;
    let storedThreadId = threadId;
    if (demo) {
      const scope = await ensureDemoScope();
      storedThreadId = scopedThreadId(threadId, scope);
      const [recent] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(like(messages.threadId, `%#${scope}`), gt(messages.sentAt, new Date(Date.now() - RATE_WINDOW_MS))));
      if ((recent?.n ?? 0) >= RATE_LIMIT) return { ok: false, error: "That's a lot of messages for a demo. Wait a few minutes and try again." };
      await db.delete(messages).where(and(like(messages.threadId, "%#%"), lt(messages.sentAt, new Date(Date.now() - DEMO_MESSAGE_TTL_MS))));
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

/** Marks every message the session user received in a thread as read (and refreshes the nav badges). */
export async function markThreadRead(threadId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || !otherUserIn(threadId, session.user.id)) return { ok: false };
  try {
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.threadId, threadId), eq(messages.toUserId, session.user.id), isNull(messages.readAt)));
  } catch {
    return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marks the latest message the session user received in a thread as unread again. */
export async function markThreadUnread(threadId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || !otherUserIn(threadId, session.user.id)) return { ok: false };
  try {
    const [latest] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.threadId, threadId), eq(messages.toUserId, session.user.id)))
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

const NotificationId = z.number().int().positive();

/** Marks one of the session user's notifications read or unread. */
export async function setNotificationRead(id: number, read: boolean): Promise<{ ok: boolean }> {
  const session = await getSession();
  const parsed = NotificationId.safeParse(id);
  if (!session || !parsed.success) return { ok: false };
  try {
    await db
      .update(notifications)
      .set({ readAt: read ? new Date() : null })
      .where(and(eq(notifications.id, parsed.data), eq(notifications.userId, session.user.id)));
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
