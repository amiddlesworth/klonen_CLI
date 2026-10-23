import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages, notifications, organizations, people, users } from "@/db/schema";
import { DEMO_USER_ID, type DemoRole } from "@/lib/session";

/** Unread counts for the nav badges. */
export async function getShellCounts(userId: string): Promise<{ unreadMessages: number; newNotifications: number }> {
  const [[m], [n]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.toUserId, userId), isNull(messages.readAt))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { unreadMessages: m?.n ?? 0, newNotifications: n?.n ?? 0 };
}

export type DemoAccount = { role: DemoRole; name: string; detail: string | null };

/** The demo accounts offered by the demo switcher, with a one-line description each. */
export async function getDemoAccounts(): Promise<DemoAccount[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      personTitle: people.currentTitle,
      orgShortName: organizations.shortName,
    })
    .from(users)
    .leftJoin(people, eq(people.id, users.personId))
    .leftJoin(organizations, sql`${organizations.id} = coalesce(${users.orgId}, ${people.currentOrgId})`)
    .where(eq(users.isDemo, true));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (Object.keys(DEMO_USER_ID) as DemoRole[]).flatMap((role) => {
    const r = byId.get(DEMO_USER_ID[role]);
    if (!r) return [];
    const detail = role === "coach" ? [r.personTitle, r.orgShortName].filter(Boolean).join(" · ") : r.orgShortName ? `Athletic director · ${r.orgShortName}` : null;
    return [{ role, name: r.name, detail: detail || null }];
  });
}
