"use server";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { messages, notifications, users } from "@/db/schema";
import { MAX_MESSAGE_LENGTH } from "@/components/messaging/limits";
import { otherUserIn } from "@/lib/queries/messaging";
import { getSession } from "@/lib/session";

const SIGNED_OUT = "Pick a demo account in the Me menu to use messaging.";

export type SendMessageResult = { ok: true; id: number } | { ok: false; error: string };

const SendInput = z.object({
  threadId: z.string().min(3).max(200),
  body: z.string().transform((s) => s.trim()).pipe(z.string().min(1, "Write a message first.").max(MAX_MESSAGE_LENGTH, `Keep messages under ${MAX_MESSAGE_LENGTH} characters.`)),
});

/**
 * Sends a message in one of the session user's conversations. Messages written from a demo account
 * are demo records (isDemo), like the conversations they answer.
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
    const [row] = await db
      .insert(messages)
      .values({ threadId, fromUserId: me, toUserId: otherId, body, isDemo: session.user.isDemo })
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
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.threadId, threadId), eq(messages.toUserId, session.user.id), isNull(messages.readAt)));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marks the latest message the session user received in a thread as unread again. */
export async function markThreadUnread(threadId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || !otherUserIn(threadId, session.user.id)) return { ok: false };
  const [latest] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.threadId, threadId), eq(messages.toUserId, session.user.id)))
    .orderBy(desc(messages.sentAt), desc(messages.id))
    .limit(1);
  if (!latest) return { ok: false };
  await db.update(messages).set({ readAt: null }).where(eq(messages.id, latest.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

const NotificationId = z.number().int().positive();

/** Marks one of the session user's notifications read or unread. */
export async function setNotificationRead(id: number, read: boolean): Promise<{ ok: boolean }> {
  const session = await getSession();
  const parsed = NotificationId.safeParse(id);
  if (!session || !parsed.success) return { ok: false };
  await db
    .update(notifications)
    .set({ readAt: read ? new Date() : null })
    .where(and(eq(notifications.id, parsed.data), eq(notifications.userId, session.user.id)));
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marks all of the session user's notifications read. */
export async function markAllNotificationsRead(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIGNED_OUT };
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)));
  } catch {
    return { ok: false, error: "We couldn't mark your notifications as read. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
