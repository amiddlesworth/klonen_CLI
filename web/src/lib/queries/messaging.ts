import "server-only";
import { asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, messages, notifications, organizations, people, users } from "@/db/schema";

/* ---------------------------------------------------------------- messaging */

/** The other side of a conversation, as the inbox and thread header show it. */
export type Participant = {
  userId: string;
  name: string;
  firstName: string;
  /** Avatar tint key: the person's slug, or the user id for accounts without a profile. */
  tintKey: string;
  /** Profile slug when the account belongs to a coach with a profile. */
  profileSlug: string | null;
  /** "Defensive Backs Coach", "Athletic director". */
  title: string | null;
  /** Full program name ("U.S. Merchant Marine Academy"). */
  orgName: string | null;
  orgSlug: string | null;
  orgInRegistry: boolean;
  isDemo: boolean;
  /** A demo account for an invented person (no profile, or a fictional demo profile), not a real coach. */
  fictional: boolean;
};

export type ThreadSummary = {
  id: string;
  other: Participant;
  last: { body: string; sentAt: Date; fromMe: boolean };
  /** Messages to the viewer not read yet. */
  unread: number;
  /** Any message in the thread is a demo record. */
  isDemo: boolean;
};

export type ThreadMessage = { id: number; fromUserId: string; body: string; sentAt: Date; isDemo: boolean };

export type Thread = { id: string; other: Participant; messages: ThreadMessage[]; unread: number; isDemo: boolean };

/** Thread ids are the two user ids, sorted and joined by ":" (db/schema.ts). */
export function threadIdFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}

/** The other user in a thread the viewer belongs to, or null when the id is malformed or not theirs. */
export function otherUserIn(threadId: string, viewerUserId: string): string | null {
  const ids = threadId.split(":");
  if (ids.length !== 2 || ids[0] === ids[1] || !ids.includes(viewerUserId)) return null;
  if (threadIdFor(ids[0], ids[1]) !== threadId) return null;
  return ids[0] === viewerUserId ? ids[1] : ids[0];
}

const MAX_THREADS = 50;
const MAX_MESSAGES = 200;

async function loadParticipants(userIds: string[]): Promise<Map<string, Participant>> {
  if (!userIds.length) return new Map();
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      kind: users.kind,
      isDemo: users.isDemo,
      personSlug: people.slug,
      personFirst: people.firstName,
      personTitle: people.currentTitle,
      personDemo: people.isDemo,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      orgInRegistry: organizations.inRegistry,
    })
    .from(users)
    .leftJoin(people, eq(people.id, users.personId))
    .leftJoin(organizations, sql`${organizations.id} = coalesce(${users.orgId}, ${people.currentOrgId})`)
    .where(inArray(users.id, userIds));
  return new Map(
    rows.map((r) => [
      r.userId,
      {
        userId: r.userId,
        name: r.name,
        firstName: r.personFirst ?? r.name.split(/\s+/)[0],
        tintKey: r.personSlug ?? r.userId,
        profileSlug: r.personSlug ?? null,
        title: r.kind === "employer" ? "Athletic director" : (r.personTitle ?? null),
        orgName: r.orgName ?? null,
        orgSlug: r.orgSlug ?? null,
        orgInRegistry: !!r.orgInRegistry,
        isDemo: r.isDemo || !!r.personDemo,
        fictional: r.isDemo && (!r.personSlug || !!r.personDemo),
      } satisfies Participant,
    ]),
  );
}

/** The viewer's conversations, newest first: the other person, the last message and the unread count. */
export async function listThreads(viewerUserId: string): Promise<ThreadSummary[]> {
  const mine = or(eq(messages.fromUserId, viewerUserId), eq(messages.toUserId, viewerUserId));
  const rows = await db
    .select({
      threadId: messages.threadId,
      lastAt: sql<Date>`max(${messages.sentAt})`.mapWith((v: string | Date) => new Date(v)),
      unread: sql<number>`count(*) filter (where ${messages.toUserId} = ${viewerUserId} and ${messages.readAt} is null)::int`,
      anyDemo: sql<boolean>`bool_or(${messages.isDemo})`,
      lastBody: sql<string>`(array_agg(${messages.body} order by ${messages.sentAt} desc, ${messages.id} desc))[1]`,
      lastFrom: sql<string>`(array_agg(${messages.fromUserId} order by ${messages.sentAt} desc, ${messages.id} desc))[1]`,
    })
    .from(messages)
    .where(mine)
    .groupBy(messages.threadId)
    .orderBy(desc(sql`max(${messages.sentAt})`))
    .limit(MAX_THREADS);

  const others = rows.map((r) => otherUserIn(r.threadId, viewerUserId)).filter((id): id is string => !!id);
  const participants = await loadParticipants([...new Set(others)]);
  return rows.flatMap((r) => {
    const otherId = otherUserIn(r.threadId, viewerUserId);
    const other = otherId ? participants.get(otherId) : undefined;
    if (!other) return [];
    return [
      {
        id: r.threadId,
        other,
        last: { body: r.lastBody, sentAt: r.lastAt, fromMe: r.lastFrom === viewerUserId },
        unread: r.unread,
        isDemo: r.anyDemo || other.isDemo,
      },
    ];
  });
}

/** One conversation (oldest message first, the latest 200), or null when it isn't the viewer's. */
export async function getThread(viewerUserId: string, threadId: string): Promise<Thread | null> {
  const otherId = otherUserIn(threadId, viewerUserId);
  if (!otherId) return null;
  const [rows, participants] = await Promise.all([
    db
      .select({
        id: messages.id,
        fromUserId: messages.fromUserId,
        toUserId: messages.toUserId,
        body: messages.body,
        sentAt: messages.sentAt,
        readAt: messages.readAt,
        isDemo: messages.isDemo,
      })
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(desc(messages.sentAt), desc(messages.id))
      .limit(MAX_MESSAGES),
    loadParticipants([otherId]),
  ]);
  const other = participants.get(otherId);
  if (!other || !rows.length) return null;
  rows.reverse();
  return {
    id: threadId,
    other,
    messages: rows.map(({ id, fromUserId, body, sentAt, isDemo }) => ({ id, fromUserId, body, sentAt, isDemo })),
    unread: rows.filter((m) => m.toUserId === viewerUserId && !m.readAt).length,
    isDemo: rows.some((m) => m.isDemo) || other.isDemo,
  };
}

/* ------------------------------------------------------------ notifications */

export type NotificationFilter = "all" | "moves" | "jobs" | "mentions";

/** Which segment of the notifications filter a stored kind belongs to ("other" shows under All only). */
export function notificationCategory(kind: string): Exclude<NotificationFilter, "all"> | "other" {
  if (kind === "job_match" || kind === "job") return "jobs";
  if (kind === "tree" || kind === "move" || kind === "hire" || kind === "promotion") return "moves";
  if (kind === "mention" || kind === "message") return "mentions";
  return "other";
}

export type NotificationJob = { id: number; title: string; orgName: string; orgShortName: string; isSample: boolean };

export type NotificationItem = {
  id: number;
  kind: string;
  category: ReturnType<typeof notificationCategory>;
  payload: Record<string, unknown>;
  createdAt: Date;
  read: boolean;
  /** The job a job notification points at, when it can be found. */
  job: NotificationJob | null;
};

const MAX_NOTIFICATIONS = 50;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The session user's notifications, newest first (the latest 50). Job notifications carry their job. */
export async function listNotifications(userId: string): Promise<NotificationItem[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(MAX_NOTIFICATIONS);

  // A job notification names its job by id, or (seeded demo rows) by title: the oldest listing with it.
  const jobIds = rows.map((r) => num(r.payload.jobId)).filter((n): n is number => n !== null);
  const jobTitles = rows.filter((r) => num(r.payload.jobId) === null).map((r) => str(r.payload.jobTitle)).filter((t): t is string => !!t);
  const jobRows =
    jobIds.length || jobTitles.length
      ? await db
          .select({ id: jobs.id, title: jobs.title, source: jobs.source, isDemo: jobs.isDemo, orgName: organizations.name, orgShortName: organizations.shortName })
          .from(jobs)
          .innerJoin(organizations, eq(organizations.id, jobs.orgId))
          .where(or(jobIds.length ? inArray(jobs.id, jobIds) : sql`false`, jobTitles.length ? inArray(jobs.title, jobTitles) : sql`false`))
          .orderBy(asc(jobs.id))
      : [];
  const toJob = (j: (typeof jobRows)[number]): NotificationJob => ({
    id: j.id,
    title: j.title,
    orgName: j.orgName,
    orgShortName: j.orgShortName,
    isSample: j.isDemo || j.source === "sample",
  });
  const byId = new Map(jobRows.map((j) => [j.id, toJob(j)]));
  const byTitle = new Map<string, NotificationJob>();
  for (const j of jobRows) if (!byTitle.has(j.title)) byTitle.set(j.title, toJob(j));

  return rows.map((r) => {
    const jobId = num(r.payload.jobId);
    const jobTitle = str(r.payload.jobTitle);
    return {
      id: r.id,
      kind: r.kind,
      category: notificationCategory(r.kind),
      payload: r.payload,
      createdAt: r.createdAt,
      read: !!r.readAt,
      job: jobId !== null ? (byId.get(jobId) ?? null) : jobTitle ? (byTitle.get(jobTitle) ?? null) : null,
    };
  });
}
