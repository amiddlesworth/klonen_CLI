import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { jobs, messages, shortlists } from "@/db/schema";
import { cookieOptions } from "@/lib/session";

/**
 * The demo scope: a random id in an httpOnly cookie that marks what one browser wrote from a shared
 * demo account (messages, job listings). Those records are shown only to that browser, so nothing a
 * visitor types is ever shown to another visitor under a demo name or under a real program's name
 * (the coach demo is a real coach; the athletic director demo posts at a real school). Seeded records
 * have no scope and everyone sees them.
 *
 * - Messages are stored under "{threadId}#{scope}" (lib/queries/messaging.ts).
 * - Job listings carry the scope in jobs.demo_scope.
 */
export const DEMO_SCOPE_COOKIE = "cn_demo_scope";
export const SCOPE_SEP = "#";
const SCOPE_PATTERN = /^[a-f0-9]{24}$/;

/** How long a browser keeps its scope. Demo messages expire sooner (7 days); listings run 30 days. */
const DEMO_SCOPE_MAX_AGE = 30 * 24 * 60 * 60;

export function isDemoScope(v: string): boolean {
  return SCOPE_PATTERN.test(v);
}

/** This browser's demo scope, or null before it has written anything (or when the cookie is malformed). */
export async function readDemoScope(): Promise<string | null> {
  const v = (await cookies()).get(DEMO_SCOPE_COOKIE)?.value;
  return v && SCOPE_PATTERN.test(v) ? v : null;
}

/** readDemoScope, or null outside a request (scripts, tests), where there are no cookies. */
export async function currentDemoScope(): Promise<string | null> {
  try {
    return await readDemoScope();
  } catch {
    return null;
  }
}

/** This browser's scope, created on its first demo write. Server actions only (it sets a cookie). */
export async function ensureDemoScope(): Promise<string> {
  const existing = await readDemoScope();
  if (existing) return existing;
  const scope = randomBytes(12).toString("hex");
  (await cookies()).set(DEMO_SCOPE_COOKIE, scope, cookieOptions(DEMO_SCOPE_MAX_AGE));
  return scope;
}

/* ---------------------------------------------------------------- messages */

/** Where a message written in this browser is stored. */
export function scopedThreadId(threadId: string, scope: string): string {
  return `${threadId}${SCOPE_SEP}${scope}`;
}

const SEP_SQL = sql.raw(`'${SCOPE_SEP}'`);

/** Messages a viewer may see: unscoped (seeded) ones, plus this browser's own scoped ones. */
export function messageVisibleTo(scope: string | null): SQL {
  const unscoped = sql`strpos(${messages.threadId}, ${SEP_SQL}) = 0`;
  return scope ? or(unscoped, sql`split_part(${messages.threadId}, ${SEP_SQL}, 2) = ${scope}`)! : unscoped;
}

/* -------------------------------------------------------------------- jobs */

/**
 * Jobs a viewer may see: every unscoped (seeded or real) listing, plus the demo listings this browser
 * posted. Every query that lists, counts or opens jobs applies it.
 */
export function jobVisibleTo(scope: string | null): SQL {
  return scope ? or(isNull(jobs.demoScope), eq(jobs.demoScope, scope))! : isNull(jobs.demoScope);
}

/** jobVisibleTo for the current request's browser. */
export async function visibleJobs(): Promise<SQL> {
  return jobVisibleTo(await currentDemoScope());
}

/** The same rule as raw SQL for hand-written queries over `jobs` (unqualified column names). */
export async function visibleJobsRaw(): Promise<SQL> {
  const scope = await currentDemoScope();
  return scope ? sql`(demo_scope is null or demo_scope = ${scope})` : sql`demo_scope is null`;
}

/**
 * Hiring searches a viewer may see: the seeded ones, plus the search opened with each demo listing this
 * browser posted (its name is the listing's title, so it is private like the listing).
 */
export function shortlistVisibleTo(scope: string | null): SQL {
  return scope ? or(isNull(shortlists.demoScope), eq(shortlists.demoScope, scope))! : isNull(shortlists.demoScope);
}

/** shortlistVisibleTo for the current request's browser. */
export async function visibleShortlists(): Promise<SQL> {
  return shortlistVisibleTo(await currentDemoScope());
}
