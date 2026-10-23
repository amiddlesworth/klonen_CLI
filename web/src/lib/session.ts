import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, users } from "@/db/schema";

/**
 * Demo auth. The viewer picks a demo account in the Me menu; the choice lives
 * in a cookie. Real authentication replaces this module and nothing else.
 */
export const SESSION_COOKIE = "cn_demo_session";
export type DemoRole = "coach" | "employer";
export const DEMO_USER_ID: Record<DemoRole, string> = { coach: "u-demo-coach", employer: "u-demo-ad" };

export type Session = {
  user: typeof users.$inferSelect;
  person: typeof people.$inferSelect | null;
  org: typeof organizations.$inferSelect | null;
} | null;

export async function getSession(): Promise<Session> {
  const role = (await cookies()).get(SESSION_COOKIE)?.value as DemoRole | undefined;
  if (!role || !(role in DEMO_USER_ID)) return null;
  return loadDemoSession(role);
}

/** The session a demo account would have, without reading the cookie (the component gallery uses it). */
export async function loadDemoSession(role: DemoRole): Promise<Session> {
  const [user] = await db.select().from(users).where(eq(users.id, DEMO_USER_ID[role])).limit(1);
  if (!user) return null;
  const person = user.personId ? ((await db.select().from(people).where(eq(people.id, user.personId)).limit(1))[0] ?? null) : null;
  const orgId = user.orgId ?? person?.currentOrgId ?? null;
  const org = orgId ? ((await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1))[0] ?? null) : null;
  return { user, person, org };
}
