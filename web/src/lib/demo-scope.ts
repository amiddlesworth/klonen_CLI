import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { or, sql, isNull, eq, type SQL } from "drizzle-orm";
import { jobs } from "@/db/schema";
import { DEMO_SCOPE_COOKIE, readDemoScope } from "@/lib/queries/messaging";
import { cookieOptions } from "@/lib/session";

/**
 * The demo scope: a random id in an httpOnly cookie that marks what one browser wrote from a shared
 * demo account (messages, job listings). Those records are shown only to that browser, so nothing a
 * visitor types is shown to anyone else under a demo name or a real program's name. The cookie and
 * its format live with the messaging queries (readDemoScope validates it: 24 hex characters).
 */
export { DEMO_SCOPE_COOKIE, readDemoScope };

/** How long a browser keeps its scope. Demo messages expire sooner (7 days); listings run 30 days. */
const DEMO_SCOPE_MAX_AGE = 30 * 24 * 60 * 60;

/** This browser's scope, created on its first demo write. Server actions only (it sets a cookie). */
export async function ensureDemoScope(): Promise<string> {
  const existing = await readDemoScope();
  if (existing) return existing;
  const scope = randomBytes(12).toString("hex");
  (await cookies()).set(DEMO_SCOPE_COOKIE, scope, cookieOptions(DEMO_SCOPE_MAX_AGE));
  return scope;
}

/**
 * Jobs a viewer may see: every unscoped (seeded or real) listing, plus the demo listings this browser
 * posted. Every query that lists, counts or opens jobs applies it.
 */
export function jobVisibleTo(scope: string | null): SQL {
  return scope ? or(isNull(jobs.demoScope), eq(jobs.demoScope, scope))! : isNull(jobs.demoScope);
}

/** jobVisibleTo for the current request's browser. */
export async function visibleJobs(): Promise<SQL> {
  return jobVisibleTo(await readDemoScope());
}

/** A listing posted from a demo account in some browser (shown only there, labeled "Demo listing"). */
export const isScopedJob = sql<boolean>`${jobs.demoScope} is not null`;
