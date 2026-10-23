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
export const DEMO_ROLES = ["coach", "employer"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];
export const DEMO_USER_ID: Record<DemoRole, string> = { coach: "u-demo-coach", employer: "u-demo-ad" };

/**
 * True only for the demo roles themselves. An own-property check, not `in`: the cookie is client
 * input, and `in` walks the prototype chain, so "__proto__", "constructor" or "toString" would pass.
 */
export function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === "string" && Object.hasOwn(DEMO_USER_ID, value);
}

/**
 * Options for every cookie the app sets: httpOnly (no script reads it), SameSite=Lax, whole site,
 * and Secure in production so it never travels over plain HTTP.
 */
export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export type Session = {
  user: typeof users.$inferSelect;
  person: typeof people.$inferSelect | null;
  org: typeof organizations.$inferSelect | null;
} | null;

export async function getSession(): Promise<Session> {
  const role = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isDemoRole(role)) return null;
  return loadDemoSession(role);
}

/** The session a demo account would have, without reading the cookie. */
export async function loadDemoSession(role: DemoRole): Promise<Session> {
  if (!isDemoRole(role)) return null;
  const [user] = await db.select().from(users).where(eq(users.id, DEMO_USER_ID[role])).limit(1);
  if (!user) return null;
  const person = user.personId ? ((await db.select().from(people).where(eq(people.id, user.personId)).limit(1))[0] ?? null) : null;
  const orgId = user.orgId ?? person?.currentOrgId ?? null;
  const org = orgId ? ((await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1))[0] ?? null) : null;
  return { user, person, org };
}
