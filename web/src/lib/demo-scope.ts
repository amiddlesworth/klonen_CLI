import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, count, eq, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { jobs, messages, shortlistEntries, shortlists } from "@/db/schema";
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
 * - Hiring searches carry it in shortlists.demo_scope; a seeded search is copied on a browser's first
 *   write to it ("pipeline" below).
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

/* ---------------------------------------------------------------- pipeline */

/*
 * Hiring searches. Nothing a browser does to a pipeline from the shared athletic director demo (adding
 * a coach, writing a note, moving or removing a candidate) is shown to any other browser:
 *
 * - The search opened with a demo listing belongs to the browser that posted it (shortlists.demoScope).
 * - A seeded search is never written from the demo. A browser's first write to one copies it, with its
 *   candidates, into a search of its own (copyShortlistForScope: clonedFromId = the seeded search,
 *   demoScope = the browser's scope). From then on that browser reads and writes its copy, and the
 *   seeded search stays as seeded for everyone else.
 * - A copy goes by the seeded search's id (shortlistPublicId), so `?list=` URLs, the job switcher and
 *   "View pipeline" links stay the same when the copy is made.
 * - Scoped searches expire (demoExpiresAt): a copy DEMO_PIPELINE_TTL_MS after its last write, a
 *   listing's search with its listing. Candidates per scoped search and live copies are capped.
 */

const DAY_MS = 86_400_000;
/** A browser's copy of a seeded search is deleted this long after its last write (like demo messages). */
export const DEMO_PIPELINE_TTL_MS = 7 * DAY_MS;
/** The search opened with a demo listing lives as long as the listing (lib/actions/jobs.ts). */
export const DEMO_LISTING_SEARCH_TTL_MS = 30 * DAY_MS;
/** Candidates one scoped search may hold. */
export const DEMO_SEARCH_CANDIDATE_LIMIT = 50;
/**
 * Copies of seeded searches all browsers together may hold. A client that drops its scope cookie gets a
 * fresh scope (and a fresh copy) on its next write, so this server-side cap is what bounds the table.
 */
export const DEMO_PIPELINE_COPY_LIMIT = 2_000;

/**
 * Hiring searches a viewer may see: its own scoped searches (the searches opened with the demo listings
 * this browser posted, and its copies of seeded searches), plus every seeded search it has not copied.
 */
export function shortlistVisibleTo(scope: string | null): SQL {
  if (!scope) return isNull(shortlists.demoScope);
  return or(
    eq(shortlists.demoScope, scope),
    and(
      isNull(shortlists.demoScope),
      sql`not exists (select 1 from ${shortlists} as own_copy where own_copy.cloned_from_id = ${shortlists.id} and own_copy.demo_scope = ${scope})`,
    ),
  )!;
}

/** shortlistVisibleTo for the current request's browser. */
export async function visibleShortlists(): Promise<SQL> {
  return shortlistVisibleTo(await currentDemoScope());
}

/** A search's public id: a browser's copy goes by the id of the seeded search it stands in for. */
export function shortlistPublicId(): SQL<number> {
  return sql<number>`coalesce(${shortlists.clonedFromId}, ${shortlists.id})`.mapWith(Number);
}

/** The stored search a browser reads for a public search id: its own copy of a seeded search, if any. */
export async function readableShortlistId(publicId: number, scope: string | null): Promise<number> {
  if (!scope) return publicId;
  const [copy] = await db
    .select({ id: shortlists.id })
    .from(shortlists)
    .where(and(eq(shortlists.clonedFromId, publicId), eq(shortlists.demoScope, scope)))
    .limit(1);
  return copy?.id ?? publicId;
}

/** readableShortlistId for the current request's browser. */
export async function readableShortlist(publicId: number): Promise<number> {
  return readableShortlistId(publicId, await currentDemoScope());
}

/** Deletes expired scoped searches, with their candidates and notes (cascade). */
export async function purgeExpiredDemoSearches(now = new Date()): Promise<void> {
  const listingCutoff = new Date(now.getTime() - DEMO_LISTING_SEARCH_TTL_MS);
  await db
    .delete(shortlists)
    .where(
      and(
        isNotNull(shortlists.demoScope),
        or(lt(shortlists.demoExpiresAt, now), and(isNull(shortlists.demoExpiresAt), lt(shortlists.createdAt, listingCutoff))),
      ),
    );
}

/** Keeps a scoped search for DEMO_PIPELINE_TTL_MS after a write (a listing's search keeps a later date). */
export async function touchScopedSearch(id: number, now = new Date()): Promise<void> {
  const expires = new Date(now.getTime() + DEMO_PIPELINE_TTL_MS);
  await db
    .update(shortlists)
    .set({ demoExpiresAt: expires })
    .where(and(eq(shortlists.id, id), isNotNull(shortlists.demoScope), or(isNull(shortlists.demoExpiresAt), lt(shortlists.demoExpiresAt, expires))));
}

export type ScopedCopy = { ok: true; id: number } | { ok: false; reason: "full" | "missing" };

async function findCopy(sourceId: number, scope: string): Promise<number | null> {
  const [row] = await db
    .select({ id: shortlists.id })
    .from(shortlists)
    .where(and(eq(shortlists.clonedFromId, sourceId), eq(shortlists.demoScope, scope)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * A browser's own copy of a seeded search, made on its first write to it: the search (same owner, name
 * and creation time, so it keeps its place in the switcher) with every candidate's stage, order and
 * note. Idempotent: a copy that exists, or that a racing request has just made, is returned as is.
 */
export async function copyShortlistForScope(sourceId: number, scope: string, now = new Date()): Promise<ScopedCopy> {
  if (!isDemoScope(scope)) return { ok: false, reason: "missing" };
  const existing = await findCopy(sourceId, scope);
  if (existing) return { ok: true, id: existing };

  await purgeExpiredDemoSearches(now);
  const [live] = await db.select({ n: count() }).from(shortlists).where(isNotNull(shortlists.clonedFromId));
  if ((live?.n ?? 0) >= DEMO_PIPELINE_COPY_LIMIT) return { ok: false, reason: "full" };

  const made = await db.transaction(async (tx) => {
    const [source] = await tx
      .select({ ownerUserId: shortlists.ownerUserId, name: shortlists.name, createdAt: shortlists.createdAt })
      .from(shortlists)
      .where(and(eq(shortlists.id, sourceId), isNull(shortlists.demoScope)))
      .limit(1);
    if (!source) return null;
    const [copy] = await tx
      .insert(shortlists)
      .values({
        ownerUserId: source.ownerUserId,
        name: source.name,
        createdAt: source.createdAt,
        demoScope: scope,
        clonedFromId: sourceId,
        demoExpiresAt: new Date(now.getTime() + DEMO_PIPELINE_TTL_MS),
      })
      .onConflictDoNothing({ target: [shortlists.clonedFromId, shortlists.demoScope] })
      .returning({ id: shortlists.id });
    // A racing request made the copy first (the unique index waited for it to commit).
    if (!copy) return null;
    await tx.execute(sql`
      insert into ${shortlistEntries} (shortlist_id, person_id, stage, note, position, created_at)
      select ${copy.id}, person_id, stage, note, position, created_at from ${shortlistEntries} where shortlist_id = ${sourceId}`);
    return copy.id;
  });
  if (made) return { ok: true, id: made };
  const raced = await findCopy(sourceId, scope);
  return raced ? { ok: true, id: raced } : { ok: false, reason: "missing" };
}
