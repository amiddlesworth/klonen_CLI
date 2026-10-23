import "server-only";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, messages, notifications, organizations, people, tenures, treeEdges, users } from "@/db/schema";
import { CURRENT_SEASON } from "@/lib/brand";
import { DEMO_SCOPE_COOKIE, SCOPE_SEP, currentDemoScope, isDemoScope, jobVisibleTo, messageVisibleTo, readDemoScope, scopedThreadId } from "@/lib/demo-scope";

/* ------------------------------------------------------- demo message scope */

/**
 * Messages written from a shared demo account belong to the browser that wrote them: they are stored
 * under "{threadId}#{scope}", where the scope is a random id in an httpOnly cookie, and only that
 * browser lists them. Nothing a visitor types is ever shown to another visitor under a demo name
 * (the coach demo is a real coach). Seeded demo messages have no scope and everyone sees them.
 * The scope itself (cookie, format, visibility rules) lives in lib/demo-scope.ts.
 */
export { DEMO_SCOPE_COOKIE, isDemoScope, readDemoScope, scopedThreadId };
/** The separator as a SQL literal, so the grouped expression is identical in SELECT and GROUP BY. */
const SEP_SQL = sql.raw(`'${SCOPE_SEP}'`);

/** Rows the viewer may see: unscoped (seeded) messages, plus this browser's own scoped ones. */
const visibleTo = messageVisibleTo;

const baseThreadId = sql<string>`split_part(${messages.threadId}, ${SEP_SQL}, 1)`;

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
  /** "Defensive Backs Coach", "Athletic Director", "Search consultant" (Title Case, as published). */
  title: string | null;
  /** Full program name ("U.S. Merchant Marine Academy"). */
  orgName: string | null;
  /** The program's short name ("Pacific (OR)"), for the compact phone header. */
  orgShortName: string | null;
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
      orgShortName: organizations.shortName,
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
        // An employer account with a program is its athletic director; one without (a search firm) is a consultant.
        title: r.kind === "employer" ? (r.orgName ? "Athletic Director" : "Search consultant") : (r.personTitle ?? null),
        orgName: r.orgName ?? null,
        orgShortName: r.orgShortName ?? null,
        orgSlug: r.orgSlug ?? null,
        orgInRegistry: !!r.orgInRegistry,
        isDemo: r.isDemo || !!r.personDemo,
        fictional: r.isDemo && (!r.personSlug || !!r.personDemo),
      } satisfies Participant,
    ]),
  );
}

/**
 * The viewer's conversations, newest first: the other person, the last message and the unread count.
 * `scope` adds the messages this browser wrote from a demo account (readDemoScope()).
 */
export async function listThreads(viewerUserId: string, scope: string | null = null): Promise<ThreadSummary[]> {
  const mine = or(eq(messages.fromUserId, viewerUserId), eq(messages.toUserId, viewerUserId));
  const rows = await db
    .select({
      threadId: baseThreadId,
      lastAt: sql<Date>`max(${messages.sentAt})`.mapWith((v: string | Date) => new Date(v)),
      unread: sql<number>`count(*) filter (where ${messages.toUserId} = ${viewerUserId} and ${messages.readAt} is null)::int`,
      anyDemo: sql<boolean>`bool_or(${messages.isDemo})`,
      lastBody: sql<string>`(array_agg(${messages.body} order by ${messages.sentAt} desc, ${messages.id} desc))[1]`,
      lastFrom: sql<string>`(array_agg(${messages.fromUserId} order by ${messages.sentAt} desc, ${messages.id} desc))[1]`,
    })
    .from(messages)
    .where(and(mine, visibleTo(scope)))
    .groupBy(baseThreadId)
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
export async function getThread(viewerUserId: string, threadId: string, scope: string | null = null): Promise<Thread | null> {
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
      .where(scope ? inArray(messages.threadId, [threadId, scopedThreadId(threadId, scope)]) : eq(messages.threadId, threadId))
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

/** Someone a "Message" button points at (/messaging?to={slug}): a person with a profile. */
export type ComposeTarget = Omit<Participant, "userId"> & {
  /** Their account, when they have one (only demo accounts do today). */
  userId: string | null;
  /** The coach claimed the profile. */
  claimed: boolean;
  /**
   * Messages can reach them: they claimed the profile or have an account. A profile built from public
   * sources (unclaimed, no account) can't receive messages until the coach claims it (DESIGN.md §8.4).
   */
  canReceive: boolean;
};

/** The person behind /messaging?to={slug}, or null when the slug matches no profile. */
export async function getComposeTarget(slug: string): Promise<ComposeTarget | null> {
  const [r] = await db
    .select({
      userId: users.id,
      personSlug: people.slug,
      name: people.fullName,
      first: people.firstName,
      title: people.currentTitle,
      personDemo: people.isDemo,
      claimed: people.claimed,
      orgName: organizations.name,
      orgShortName: organizations.shortName,
      orgSlug: organizations.slug,
      orgInRegistry: organizations.inRegistry,
    })
    .from(people)
    .leftJoin(users, eq(users.personId, people.id))
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(eq(people.slug, slug))
    .limit(1);
  if (!r) return null;
  return {
    userId: r.userId ?? null,
    name: r.name,
    firstName: r.first ?? r.name.split(/\s+/)[0],
    tintKey: r.personSlug,
    profileSlug: r.personSlug,
    title: r.title ?? null,
    orgName: r.orgName ?? null,
    orgShortName: r.orgShortName ?? null,
    orgSlug: r.orgSlug ?? null,
    orgInRegistry: !!r.orgInRegistry,
    isDemo: r.personDemo,
    fictional: r.personDemo,
    claimed: r.claimed,
    canReceive: r.claimed || !!r.userId,
  };
}

/* ------------------------------------------------------------ notifications */

export type NotificationFilter = "all" | "moves" | "jobs" | "mentions";

/** Stored notification kinds per filter segment ("other" kinds show under All only). */
const CATEGORY_KINDS: Record<Exclude<NotificationFilter, "all">, string[]> = {
  jobs: ["job_match", "job"],
  moves: ["tree", "move", "hire", "promotion"],
  mentions: ["mention", "message"],
};

/** Which segment of the notifications filter a stored kind belongs to ("other" shows under All only). */
export function notificationCategory(kind: string): Exclude<NotificationFilter, "all"> | "other" {
  for (const [category, kinds] of Object.entries(CATEGORY_KINDS)) {
    if (kinds.includes(kind)) return category as Exclude<NotificationFilter, "all">;
  }
  return "other";
}

/** The stored kinds a filter shows, or null for All. */
export function notificationKinds(filter: NotificationFilter): string[] | null {
  return filter === "all" ? null : CATEGORY_KINDS[filter];
}

export type NotificationJob = { id: number; title: string; orgName: string; orgShortName: string; isSample: boolean };

/** How the person in a move is related to the viewer, from tree_edges (the most recent edge). */
export type TreeRelation = {
  /** "under_them": the viewer worked under the person; "under_you": the person worked under the viewer. */
  kind: "under_them" | "under_you" | "alongside";
  orgShortName: string;
};

/**
 * A move in the viewer's coaching tree (a stint that started in CURRENT_SEASON), derived from tenures
 * and tree_edges, for a tree/move notification. Seasons, not dates: the row says "2026 season".
 */
export type NotificationMove = {
  kind: "joined" | "promoted";
  personSlug: string;
  personName: string;
  personFirstName: string;
  role: string;
  orgId: string;
  orgName: string;
  orgShortName: string;
  sourceUrl: string | null;
  /** False when the start season was worked out from the bio rather than stated in it (§6.2). */
  yearsExplicit: boolean;
  /** The verbatim staff-bio sentence the stint comes from. */
  evidence: string | null;
  relation: TreeRelation | null;
};

export type NotificationItem = {
  id: number;
  kind: string;
  category: ReturnType<typeof notificationCategory>;
  payload: Record<string, unknown>;
  createdAt: Date;
  read: boolean;
  /** The job a job notification points at, when it can be found. */
  job: NotificationJob | null;
  /** The move a tree/move notification is about, when one can be found. */
  move: NotificationMove | null;
};

const MAX_NOTIFICATIONS = 50;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Current-season moves by people in a coach's tree (worked under, alongside, or coached under them,
 * either direction of tree_edges): non-playing football stints that started in CURRENT_SEASON, one per
 * person, oldest record first. A stint after an earlier coaching stint at the same program is a promotion.
 * Each move carries how the person is related to the viewer (their most recent shared edge).
 */
async function treeMoves(personId: string): Promise<NotificationMove[]> {
  const edges = await db
    .select({
      kind: treeEdges.kind,
      mentorId: treeEdges.mentorId,
      menteeId: treeEdges.menteeId,
      orgShortName: organizations.shortName,
    })
    .from(treeEdges)
    .innerJoin(organizations, eq(organizations.id, treeEdges.orgId))
    .where(or(eq(treeEdges.mentorId, personId), eq(treeEdges.menteeId, personId)))
    .orderBy(desc(sql`coalesce(${treeEdges.endYear}, ${treeEdges.startYear})`), desc(treeEdges.startYear));
  const relations = new Map<string, TreeRelation>();
  for (const e of edges) {
    const other = e.mentorId === personId ? e.menteeId : e.mentorId;
    if (relations.has(other)) continue;
    const kind = e.kind === "worked_alongside" ? "alongside" : e.mentorId === personId ? "under_you" : "under_them";
    relations.set(other, { kind, orgShortName: e.orgShortName });
  }
  if (!relations.size) return [];

  const rows = await db
    .select({
      personId: people.id,
      personSlug: people.slug,
      personName: people.fullName,
      personFirstName: people.firstName,
      role: tenures.role,
      orgId: organizations.id,
      orgName: organizations.name,
      orgShortName: organizations.shortName,
      sourceUrl: tenures.sourceUrl,
      yearsExplicit: tenures.yearsExplicit,
      evidence: tenures.evidence,
      promoted: sql<boolean>`exists (select 1 from tenures t2 where t2.person_id = ${tenures.personId} and t2.org_id = ${tenures.orgId}
        and t2.id <> ${tenures.id} and not t2.as_player and t2.start_year < ${CURRENT_SEASON})`,
    })
    .from(tenures)
    .innerJoin(people, eq(people.id, tenures.personId))
    .innerJoin(organizations, eq(organizations.id, tenures.orgId))
    .where(
      and(
        inArray(tenures.personId, [...relations.keys()]),
        ne(tenures.personId, personId),
        eq(tenures.startYear, CURRENT_SEASON),
        eq(tenures.asPlayer, false),
        eq(tenures.sport, "football"),
        eq(people.isDemo, false),
      ),
    )
    .orderBy(asc(tenures.id))
    .limit(40);
  const seen = new Set<string>();
  return rows.flatMap(({ promoted, personId: id, personFirstName, ...r }) => {
    if (seen.has(id)) return [];
    seen.add(id);
    return [
      {
        ...r,
        personFirstName: personFirstName ?? r.personName.split(/\s+/)[0],
        kind: promoted ? ("promoted" as const) : ("joined" as const),
        relation: relations.get(id) ?? null,
      },
    ];
  });
}

/**
 * The session user's notifications, newest first (the latest 50). Job notifications carry their job;
 * tree/move notifications carry a real current-season move from the viewer's tree (`personId`): the
 * one their payload names (personSlug), else the next one not shown by a newer notification.
 */
export async function listNotifications(userId: string, personId: string | null = null): Promise<NotificationItem[]> {
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
          .where(and(or(jobIds.length ? inArray(jobs.id, jobIds) : sql`false`, jobTitles.length ? inArray(jobs.title, jobTitles) : sql`false`), jobVisibleTo(await currentDemoScope())))
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

  const isMove = (kind: string) => kind === "tree" || kind === "move";
  const moves = personId && rows.some((r) => isMove(r.kind)) ? await treeMoves(personId) : [];
  const named = new Set(rows.map((r) => (isMove(r.kind) ? str(r.payload.personSlug) : null)).filter(Boolean));
  const unnamed = moves.filter((m) => !named.has(m.personSlug));

  return rows.map((r) => {
    const jobId = num(r.payload.jobId);
    const jobTitle = str(r.payload.jobTitle);
    const slug = isMove(r.kind) ? str(r.payload.personSlug) : null;
    const move = isMove(r.kind) ? ((slug ? moves.find((m) => m.personSlug === slug) : unnamed.shift()) ?? null) : null;
    return {
      id: r.id,
      kind: r.kind,
      category: notificationCategory(r.kind),
      payload: r.payload,
      createdAt: r.createdAt,
      read: !!r.readAt,
      job: jobId !== null ? (byId.get(jobId) ?? null) : jobTitle ? (byTitle.get(jobTitle) ?? null) : null,
      move,
    };
  });
}
