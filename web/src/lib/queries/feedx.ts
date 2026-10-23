import "server-only";
import { cache } from "react";
import { and, count, eq, gte, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations, people, profileViews, tenures, treeEdges } from "@/db/schema";
import { cleanTitle, isNeutralQuote, positionKeys, schoolKey, schoolShort } from "@/components/feed/text";
import { CURRENT_SEASON } from "@/lib/brand";
import { conferenceShort } from "@/lib/format";
import type { Session } from "@/lib/session";
import { getCarouselStats, getMoves, getRecentJobs } from "./feed";
import { getPeopleSummaries, getRelated } from "./people";

/*
 * Home feed queries (DESIGN.md §8.5). Moves come from getMoves() (lib/queries/feed.ts) and are
 * enriched here with each coach's recent stints, the staff-bio source and a personal reason derived
 * from the session (program, head coach, coaching tree, alma mater, conference). Nothing personal is
 * hard-coded: every reason is computed from the signed-in viewer.
 */

/** The feed's scope: Division III programs (the "Showing Division III" scope). */
export const FEED_LEVEL = "NCAA D-III";
/** Full feed items per page; the long tail goes to the digest. */
export const FULL_PER_PAGE = 6;
/** Digest rows per page ("More staff moves"). */
export const DIGEST_PER_PAGE = 12;
/** Job cards per page on the Jobs filter. */
export const JOBS_PER_PAGE = 10;

export type FeedFilter = "all" | "moves" | "jobs";

export function parseFilter(v: string | string[] | undefined): FeedFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "moves" || s === "jobs" ? s : "all";
}

export function parsePage(v: string | string[] | undefined): number {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number.parseInt(s ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

/* ---------- Types ---------- */

export type FeedOrg = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  conference: string | null;
  /** Cleaned abbreviation ("NACC[g]" -> "NACC"). */
  conferenceAbbr: string | null;
  level: string | null;
  state: string | null;
  inRegistry: boolean;
};

export type RecordRow = {
  key: number;
  /** Sentence-case title as published, "(player)" for playing stints; formatted by the component. */
  role: string;
  asPlayer: boolean;
  /** Program short name, or null when the row drops it (same-org promotions). */
  org: string | null;
  startYear: number | null;
  endYear: number | null;
  isCurrent: boolean;
  inferred: boolean;
  /** The new role (last row). */
  now: boolean;
};

export type PriorStint = {
  role: string;
  orgShortName: string;
  startYear: number | null;
  endYear: number | null;
  inferred: boolean;
  asPlayer: boolean;
};

export type FeedMove = {
  key: string;
  kind: "joined" | "promoted";
  person: { id: string; slug: string; fullName: string; firstName: string | null; almaMater: string | null };
  /** Current title as published (cleaned of table leftovers). */
  role: string;
  roleGroup: string;
  org: FeedOrg;
  sourceUrl: string | null;
  /** A verbatim, pronoun-free line from the new staff bio that adds a fact, or null. */
  quote: string | null;
  /** The last 2–3 stints, oldest first, ending on the new role. Empty when there is no prior stint. */
  record: RecordRow[];
  /** The latest prior coaching stint (else the latest playing stint), for digest sentences and "Previously …" lines. */
  previous: PriorStint | null;
  /** Prior stints at other programs: org id → played there only (true) or coached there (false). */
  priorOrgs: Record<string, boolean>;
  /** Any year shown in the record is inferred (yearsExplicit = false). */
  recordInferred: boolean;
  /** The year in the digest sentence (previous stint) is inferred. */
  previousInferred: boolean;
};

export type ReasonKind = "program" | "headCoach" | "colleague" | "formerStaff" | "alum" | "conference";
export type FeedReason = { kind: ReasonKind; subject: string; text: string };

export type FeedJob = {
  id: number;
  title: string;
  roleGroup: string;
  employmentType: string;
  isSample: boolean;
  org: FeedOrg;
  matchesPosition: boolean;
  atViewerProgram: boolean;
  inViewerConference: boolean;
  /** Colleagues of the viewer who played or coached at this program (up to 3 shown). */
  network: { people: { slug: string; fullName: string }[]; total: number; verb: "played" | "coached" | "played or coached" } | null;
};

export type FeedEntry =
  | { type: "move"; key: string; move: FeedMove; reason: FeedReason | null }
  | { type: "group"; key: string; org: FeedOrg; moves: FeedMove[]; reason: FeedReason | null; sourceUrl: string | null }
  | { type: "job"; key: string; job: FeedJob };

export type FeedViewer = {
  role: "coach" | "employer";
  personId: string | null;
  slug: string | null;
  name: string;
  /** Avatar tint key, the same as the shell's (the person's slug, or the user id). */
  tintKey: string;
  title: string | null;
  almaMater: string | null;
  org: FeedOrg | null;
  headCoach: { id: string; slug: string; fullName: string } | null;
  /** First-degree tree colleagues (worked under / alongside the viewer). */
  colleagues: { id: string; slug: string; fullName: string; edgeOrgShortName: string; edgeOrgId: string }[];
};

/* ---------- Viewer ---------- */

const orgCols = {
  id: organizations.id,
  slug: organizations.slug,
  name: organizations.name,
  shortName: organizations.shortName,
  conference: organizations.conference,
  conferenceAbbr: organizations.conferenceAbbr,
  level: organizations.level,
  state: organizations.state,
  inRegistry: organizations.inRegistry,
};

function toOrg(o: typeof organizations.$inferSelect | { id: string; slug: string; name: string; shortName: string; conference: string | null; conferenceAbbr: string | null; level: string | null; state: string | null; inRegistry: boolean }): FeedOrg {
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    shortName: o.shortName,
    conference: o.conference,
    conferenceAbbr: conferenceShort(o.conferenceAbbr),
    level: o.level,
    state: o.state,
    inRegistry: o.inRegistry,
  };
}

/** Everything the feed needs to know about the signed-in viewer, derived from the session. */
export async function getFeedViewer(session: NonNullable<Session>): Promise<FeedViewer> {
  const { user, person, org } = session;
  const [headCoach, colleagues] = await Promise.all([
    org
      ? db
          .select({ id: people.id, slug: people.slug, fullName: people.fullName })
          .from(people)
          .where(and(eq(people.currentOrgId, org.id), eq(people.roleGroup, "head_coach"), eq(people.isDemo, false)))
          .orderBy(people.fullName)
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    person ? getColleagues(person.id) : Promise.resolve([]),
  ]);
  return {
    role: user.kind === "employer" ? "employer" : "coach",
    personId: person?.id ?? null,
    slug: person?.slug ?? null,
    name: user.name,
    tintKey: person?.slug ?? user.id,
    title: user.kind === "employer" ? "Athletic director" : cleanTitle(person?.currentTitle) || null,
    almaMater: person?.almaMater ?? null,
    org: org ? toOrg(org) : null,
    headCoach: headCoach && headCoach.id !== person?.id ? headCoach : null,
    colleagues,
  };
}

async function getColleagues(personId: string) {
  const rows = await db
    .select({
      mentorId: treeEdges.mentorId,
      menteeId: treeEdges.menteeId,
      endYear: treeEdges.endYear,
      orgId: organizations.id,
      orgShortName: organizations.shortName,
    })
    .from(treeEdges)
    .innerJoin(organizations, eq(organizations.id, treeEdges.orgId))
    .where(or(eq(treeEdges.mentorId, personId), eq(treeEdges.menteeId, personId)))
    .orderBy(sql`${treeEdges.endYear} desc nulls last`);
  const ids = [...new Set(rows.map((r) => (r.mentorId === personId ? r.menteeId : r.mentorId)))];
  if (!ids.length) return [];
  const names = await db.select({ id: people.id, slug: people.slug, fullName: people.fullName }).from(people).where(inArray(people.id, ids));
  const byId = new Map(names.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: FeedViewer["colleagues"] = [];
  for (const r of rows) {
    const id = r.mentorId === personId ? r.menteeId : r.mentorId;
    const p = byId.get(id);
    if (!p || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...p, edgeOrgShortName: r.orgShortName, edgeOrgId: r.orgId });
  }
  return out;
}

/* ---------- Moves ---------- */

const RESTATES_HIRE = /\b(joins|joined|enters|entering|rejoins|returns|returned|named|hired|first season)\b/i;

function pickQuote(excerpt: string | null): string | null {
  if (!excerpt) return null;
  const q = excerpt.trim().replace(/\s+/g, " ");
  if (q.length < 30 || q.length > 240) return null;
  if (!/^[A-Z“"]/.test(q)) return null;
  if (!isNeutralQuote(q) || RESTATES_HIRE.test(q)) return null;
  return q;
}

/** All Division III hires and promotions this season, with records, sources and quotes. Cached per request. */
export const getAllFeedMoves = cache(async (): Promise<FeedMove[]> => {
  const moves = await getMoves(5000, 0);
  if (!moves.length) return [];
  const ids = moves.map((m) => m.person.id);
  const [rows, persons] = await Promise.all([
    db
      .select({
        id: tenures.id,
        personId: tenures.personId,
        role: tenures.role,
        roleGroup: tenures.roleGroup,
        startYear: tenures.startYear,
        endYear: tenures.endYear,
        isCurrent: tenures.isCurrent,
        asPlayer: tenures.asPlayer,
        yearsExplicit: tenures.yearsExplicit,
        sourceUrl: tenures.sourceUrl,
        sortOrder: tenures.sortOrder,
        org: orgCols,
      })
      .from(tenures)
      .innerJoin(organizations, eq(organizations.id, tenures.orgId))
      .where(inArray(tenures.personId, ids))
      .orderBy(tenures.personId, tenures.sortOrder, tenures.id),
    db
      .select({ id: people.id, firstName: people.firstName, almaMater: people.almaMater, bioExcerpt: people.bioExcerpt, sourceUrl: people.sourceUrl })
      .from(people)
      .where(inArray(people.id, ids)),
  ]);
  const byPerson = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byPerson.get(r.personId);
    if (list) list.push(r);
    else byPerson.set(r.personId, [r]);
  }
  const personById = new Map(persons.map((p) => [p.id, p]));

  const out: FeedMove[] = [];
  for (const m of moves) {
    const stints = byPerson.get(m.person.id) ?? [];
    const current = stints.find((s) => s.isCurrent && !s.asPlayer && s.startYear === CURRENT_SEASON);
    if (!current || current.org.level !== FEED_LEVEL) continue;
    const info = personById.get(m.person.id);
    const prior = stints.filter((s) => s.id !== current.id && !s.isCurrent);
    const coaching = prior.filter((s) => !s.asPlayer);
    const playing = prior.filter((s) => s.asPlayer);

    const toRow = (s: (typeof stints)[number], dropOrg: boolean, now = false): RecordRow => ({
      key: s.id,
      role: cleanTitle(s.role),
      asPlayer: s.asPlayer,
      org: dropOrg ? null : s.org.shortName,
      startYear: s.startYear,
      endYear: now ? s.startYear : s.endYear,
      isCurrent: false,
      inferred: !s.yearsExplicit,
      now,
    });

    let record: RecordRow[] = [];
    if (m.kind === "promoted") {
      const same = coaching.filter((s) => s.org.id === current.org.id).slice(0, 2).reverse();
      if (same.length) record = [...same.map((s) => toRow(s, true)), toRow(current, true, true)];
    } else if (coaching.length) {
      record = [...coaching.slice(0, 2).reverse().map((s) => toRow(s, false)), toRow(current, false, true)];
    } else if (playing.length) {
      record = [...playing.slice(0, 2).reverse().map((s) => toRow(s, false)), toRow(current, false, true)];
    }
    const prev = coaching[0] ?? playing[0] ?? null;
    const priorOrgs: Record<string, boolean> = {};
    for (const s of prior) priorOrgs[s.org.id] = (priorOrgs[s.org.id] ?? true) && s.asPlayer;

    out.push({
      key: m.person.id,
      kind: m.kind,
      person: { id: m.person.id, slug: m.person.slug, fullName: m.person.fullName, firstName: info?.firstName ?? null, almaMater: info?.almaMater ?? null },
      role: cleanTitle(current.role),
      roleGroup: current.roleGroup,
      org: toOrg(current.org),
      sourceUrl: current.sourceUrl ?? info?.sourceUrl ?? null,
      quote: pickQuote(info?.bioExcerpt ?? null),
      record,
      previous: prev
        ? { role: cleanTitle(prev.role), orgShortName: prev.org.shortName, startYear: prev.startYear, endYear: prev.endYear, inferred: !prev.yearsExplicit, asPlayer: prev.asPlayer }
        : null,
      priorOrgs,
      recordInferred: record.some((r) => r.inferred && r.startYear !== null),
      previousInferred: !!prev && !prev.yearsExplicit && prev.startYear !== null,
    });
  }
  return out;
});

/* ---------- Personal reasons ---------- */

const REASON_RANK: Record<ReasonKind, number> = { program: 0, headCoach: 1, colleague: 2, formerStaff: 3, alum: 4, conference: 5 };

/** Why this move is in the viewer's feed, from the session; null when there is no personal reason. */
export function reasonFor(move: FeedMove, viewer: FeedViewer): FeedReason | null {
  const org = viewer.org;
  if (org && move.org.id === org.id) return { kind: "program", subject: org.shortName, text: "your program" };
  if (viewer.headCoach && move.person.id === viewer.headCoach.id) return { kind: "headCoach", subject: move.person.fullName, text: "your head coach" };
  const colleague = viewer.colleagues.find((c) => c.id === move.person.id);
  if (colleague) return { kind: "colleague", subject: move.person.fullName, text: `worked with you at ${colleague.edgeOrgShortName}` };
  if (org && org.id in move.priorOrgs) return { kind: "formerStaff", subject: org.shortName, text: move.priorOrgs[org.id] ? "played at your program" : "coached at your program" };
  const vSchool = schoolKey(viewer.almaMater);
  if (vSchool && schoolKey(move.person.almaMater) === vSchool) return { kind: "alum", subject: schoolShort(viewer.almaMater!), text: "alum, like you" };
  if (org?.conferenceAbbr && move.org.conferenceAbbr === org.conferenceAbbr) return { kind: "conference", subject: org.conferenceAbbr, text: "your conference" };
  return null;
}

const ROLE_RANK: Record<string, number> = { head_coach: 0, coordinator: 1, position_coach: 2, ga_analyst: 3, other: 4, support: 5, player: 6 };

function importance(m: FeedMove): number {
  const base = ROLE_RANK[m.roleGroup] ?? 4;
  return base * 10 + (m.kind === "promoted" ? 0 : 1) * 2 + (m.record.length ? 0 : 1);
}

function richness(m: FeedMove): number {
  if (m.previous && !m.previous.asPlayer && m.previous.startYear) return 0;
  if (m.previous && !m.previous.asPlayer) return 1;
  if (m.previous) return 2;
  return 3;
}

const byName = (a: FeedMove, b: FeedMove) => a.person.fullName.localeCompare(b.person.fullName);

type Ordered = {
  /** Full feed items (individual moves and grouped hires), in feed order. */
  full: FeedEntry[];
  /** The long tail of moves without a personal reason, richest first. */
  digest: FeedMove[];
};

/** Orders the season's moves for the viewer: personal and notable items as full cards, the rest as a digest. */
function orderMoves(moves: FeedMove[], viewer: FeedViewer): Ordered {
  const personal: { entry: FeedEntry; rank: number; imp: number; name: string }[] = [];
  const notable: FeedMove[] = [];
  const tail: FeedMove[] = [];
  const groupable = new Map<string, { move: FeedMove; reason: FeedReason }[]>();

  for (const m of moves) {
    const reason = reasonFor(m, viewer);
    if (reason) {
      // Several new assistants at one program in the viewer's conference read better as one program item.
      if (reason.kind === "conference" && m.kind === "joined" && m.roleGroup !== "head_coach" && m.roleGroup !== "coordinator") {
        const list = groupable.get(m.org.id) ?? [];
        list.push({ move: m, reason });
        groupable.set(m.org.id, list);
      } else {
        personal.push({ entry: { type: "move", key: m.key, move: m, reason }, rank: REASON_RANK[reason.kind], imp: importance(m), name: m.person.fullName });
      }
    } else if (m.roleGroup === "head_coach" || m.roleGroup === "coordinator" || m.kind === "promoted") {
      notable.push(m);
    } else {
      tail.push(m);
    }
  }
  for (const list of groupable.values()) {
    if (list.length >= 2) {
      const ms = list.map((x) => x.move).sort((a, b) => importance(a) - importance(b) || byName(a, b));
      personal.push({
        entry: { type: "group", key: `g-${ms[0].org.id}`, org: ms[0].org, moves: ms, reason: list[0].reason, sourceUrl: ms.find((x) => x.sourceUrl)?.sourceUrl ?? null },
        rank: REASON_RANK.conference,
        imp: 25,
        name: ms[0].org.shortName,
      });
    } else {
      const { move, reason } = list[0];
      personal.push({ entry: { type: "move", key: move.key, move, reason }, rank: REASON_RANK.conference, imp: importance(move), name: move.person.fullName });
    }
  }
  personal.sort((a, b) => a.rank - b.rank || a.imp - b.imp || a.name.localeCompare(b.name));
  notable.sort((a, b) => importance(a) - importance(b) || byName(a, b));
  tail.sort((a, b) => richness(a) - richness(b) || importance(a) - importance(b) || byName(a, b));

  // Interleave: the most personal item first, then alternate with notable moves across the division.
  const full: FeedEntry[] = [];
  let p = 0;
  let n = 0;
  while (p < personal.length || n < notable.length) {
    if (p < personal.length) full.push(personal[p++].entry);
    if (n < notable.length) {
      const m = notable[n++];
      full.push({ type: "move", key: m.key, move: m, reason: null });
    }
  }
  return { full, digest: tail };
}

/* ---------- Jobs ---------- */

/** Open jobs for the feed (from getRecentJobs), ranked for the viewer, with network proof. */
export const getFeedJobs = cache(async (viewer: FeedViewer): Promise<FeedJob[]> => {
  const base = await getRecentJobs(200);
  if (!base.length) return [];
  const ids = base.map((j) => j.id);
  const details = await db
    .select({ id: jobs.id, isDemo: jobs.isDemo, org: orgCols })
    .from(jobs)
    .innerJoin(organizations, eq(organizations.id, jobs.orgId))
    .where(inArray(jobs.id, ids));
  const detailById = new Map(details.map((d) => [d.id, d]));
  const orgIds = [...new Set(details.map((d) => d.org.id))];

  // Network proof: the viewer's tree colleagues and current staff who played or coached at a job's program.
  const colleagueIds = new Set(viewer.colleagues.map((c) => c.id));
  if (viewer.org) {
    const staff = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.currentOrgId, viewer.org.id), eq(people.isDemo, false)));
    for (const s of staff) colleagueIds.add(s.id);
  }
  if (viewer.personId) colleagueIds.delete(viewer.personId);
  const ties =
    colleagueIds.size && orgIds.length
      ? await db
          .select({ personId: tenures.personId, orgId: tenures.orgId, asPlayer: tenures.asPlayer, slug: people.slug, fullName: people.fullName })
          .from(tenures)
          .innerJoin(people, eq(people.id, tenures.personId))
          .where(and(inArray(tenures.personId, [...colleagueIds]), inArray(tenures.orgId, orgIds), viewer.org ? ne(tenures.orgId, viewer.org.id) : undefined))
          .orderBy(people.fullName)
      : [];

  const viewerKeys = new Set(positionKeys(viewer.title));
  const out = base.map((j): FeedJob => {
    const d = detailById.get(j.id);
    const org = d ? toOrg(d.org) : toOrg({ id: j.org.slug, slug: j.org.slug, name: j.org.shortName, shortName: j.org.shortName, conference: null, conferenceAbbr: j.org.conferenceAbbr, level: j.org.level, state: j.org.state, inRegistry: true });
    const here = ties.filter((t) => t.orgId === org.id);
    const uniq = new Map<string, { slug: string; fullName: string; played: boolean; coached: boolean }>();
    for (const t of here) {
      const u = uniq.get(t.personId) ?? { slug: t.slug, fullName: t.fullName, played: false, coached: false };
      if (t.asPlayer) u.played = true;
      else u.coached = true;
      uniq.set(t.personId, u);
    }
    const list = [...uniq.values()];
    const verb = list.every((u) => u.played && !u.coached) ? "played" : list.every((u) => u.coached && !u.played) ? "coached" : "played or coached";
    return {
      id: j.id,
      title: j.title,
      roleGroup: j.roleGroup,
      employmentType: j.employmentType,
      isSample: j.source === "sample" || !!d?.isDemo,
      org,
      matchesPosition: positionKeys(j.title).some((k) => viewerKeys.has(k)),
      atViewerProgram: !!viewer.org && org.id === viewer.org.id,
      inViewerConference: !!viewer.org?.conferenceAbbr && org.conferenceAbbr === viewer.org.conferenceAbbr,
      network: list.length ? { people: list.slice(0, 3).map(({ slug, fullName }) => ({ slug, fullName })), total: list.length, verb } : null,
    };
  });
  // Stable rank: position-group matches, the viewer's program, the viewer's conference, then newest first.
  return out
    .map((j, i) => ({ j, i }))
    .sort(
      (a, b) =>
        Number(b.j.matchesPosition) - Number(a.j.matchesPosition) ||
        Number(b.j.atViewerProgram) - Number(a.j.atViewerProgram) ||
        Number(b.j.inViewerConference) - Number(a.j.inViewerConference) ||
        a.i - b.i,
    )
    .map((x) => x.j);
});

/* ---------- The feed page ---------- */

export type FeedPage = {
  filter: FeedFilter;
  page: number;
  totalPages: number;
  /** Items in display order (moves, grouped hires and jobs). */
  entries: FeedEntry[];
  /** "More staff moves" rows for this page. */
  digest: FeedMove[];
  /** Totals for the empty states. */
  totalMoves: number;
  totalJobs: number;
};

/** One page of the viewer's feed. Pages past the end return no entries (the page shows not-found). */
export async function getFeedPage(viewer: FeedViewer, filter: FeedFilter, page: number): Promise<FeedPage> {
  const [moves, jobList] = await Promise.all([filter === "jobs" ? Promise.resolve([] as FeedMove[]) : getAllFeedMoves(), filter === "moves" ? Promise.resolve([] as FeedJob[]) : getFeedJobs(viewer)]);

  if (filter === "jobs") {
    const totalPages = Math.max(1, Math.ceil(jobList.length / JOBS_PER_PAGE));
    const slice = jobList.slice((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE);
    return { filter, page, totalPages, entries: slice.map((job) => ({ type: "job", key: `j-${job.id}`, job })), digest: [], totalMoves: 0, totalJobs: jobList.length };
  }

  const { full, digest } = orderMoves(moves, viewer);
  const totalPages = Math.max(1, Math.ceil(full.length / FULL_PER_PAGE), Math.ceil(digest.length / DIGEST_PER_PAGE));
  const fullSlice = full.slice((page - 1) * FULL_PER_PAGE, page * FULL_PER_PAGE);
  const digestSlice = digest.slice((page - 1) * DIGEST_PER_PAGE, page * DIGEST_PER_PAGE).sort((a, b) => a.org.shortName.localeCompare(b.org.shortName) || byName(a, b));

  const entries: FeedEntry[] = [...fullSlice];
  if (filter === "all") {
    // One job per page, after the third item (or at the end of a short page).
    const job = jobList[page - 1];
    if (job) entries.splice(Math.min(3, entries.length), 0, { type: "job", key: `j-${job.id}`, job });
  }
  return { filter, page, totalPages, entries, digest: digestSlice, totalMoves: moves.length, totalJobs: jobList.length };
}

/* ---------- Carousel tracker ---------- */

export type TrackerRow = { conference: string; name: string | null; hires: number; promotions: number; isViewer: boolean };

export type CarouselTracker = {
  season: number;
  programs: number;
  hires: number;
  promotions: number;
  openJobs: number;
  sampleJobs: number;
  /** Top five conferences by hires (ties by promotions). */
  rows: TrackerRow[];
  /** The viewer's conference when it is not in the top five. */
  viewerRow: TrackerRow | null;
  /** Bar scale. */
  max: number;
};

/** Numbers for the right-rail tracker: hires (new program) and promotions (new role, same program) this season. */
export async function getCarouselTracker(viewer: FeedViewer): Promise<CarouselTracker> {
  const [moves, stats, [{ programs }], [{ sample }]] = await Promise.all([
    getAllFeedMoves(),
    getCarouselStats(),
    db
      .select({ programs: sql<number>`count(distinct ${people.currentOrgId})::int` })
      .from(people)
      .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(and(eq(organizations.level, FEED_LEVEL), eq(people.isDemo, false))),
    db
      .select({ sample: count() })
      .from(jobs)
      .where(and(eq(jobs.status, "open"), or(eq(jobs.source, "sample"), eq(jobs.isDemo, true)))),
  ]);
  const byConf = new Map<string, TrackerRow>();
  for (const m of moves) {
    const c = m.org.conferenceAbbr;
    if (!c) continue;
    const row = byConf.get(c) ?? { conference: c, name: m.org.conference, hires: 0, promotions: 0, isViewer: false };
    if (m.kind === "promoted") row.promotions++;
    else row.hires++;
    byConf.set(c, row);
  }
  const viewerConf = viewer.org?.conferenceAbbr ?? null;
  const sorted = [...byConf.values()].sort((a, b) => b.hires - a.hires || b.promotions - a.promotions || a.conference.localeCompare(b.conference));
  const rows = sorted.slice(0, 5).map((r) => ({ ...r, isViewer: r.conference === viewerConf }));
  let viewerRow: TrackerRow | null = null;
  if (viewerConf && !rows.some((r) => r.isViewer)) {
    const r = byConf.get(viewerConf);
    viewerRow = { conference: viewerConf, name: r?.name ?? viewer.org?.conference ?? null, hires: r?.hires ?? 0, promotions: r?.promotions ?? 0, isViewer: true };
  }
  const max = Math.max(1, ...rows.map((r) => r.hires), viewerRow?.hires ?? 0);
  return {
    season: CURRENT_SEASON,
    programs,
    hires: moves.filter((m) => m.kind === "joined").length,
    promotions: moves.filter((m) => m.kind === "promoted").length,
    openJobs: stats.openJobs,
    sampleJobs: sample,
    rows,
    viewerRow,
    max,
  };
}

/* ---------- People you may know ---------- */

export type PymkRow = {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
  orgShortName: string | null;
  claimed: boolean;
  /** The reason, shown as a ContextLine. */
  context: string;
  contextKind: "tree" | "school" | "info" | "conference";
  /** Someone the viewer already worked with: unclaimed ones get "Invite to claim" instead of Connect. */
  known: boolean;
};

const summaryCols = {
  id: people.id,
  slug: people.slug,
  fullName: people.fullName,
  currentTitle: people.currentTitle,
  roleGroup: people.roleGroup,
  claimed: people.claimed,
  orgShortName: organizations.shortName,
  orgLevel: organizations.level,
};

/**
 * Up to 3 people for the rail: the viewer's head coach (from getRelated, the coaching tree), one
 * coach two steps away through a colleague, one alum of the viewer's school, then coaches in the
 * viewer's conference as the fallback.
 */
export async function getPeopleYouMayKnow(viewer: FeedViewer, limit = 3): Promise<PymkRow[]> {
  const exclude = new Set<string>([...(viewer.personId ? [viewer.personId] : []), ...viewer.colleagues.map((c) => c.id)]);
  const rows: PymkRow[] = [];
  const taken = new Set<string>();
  const push = (r: PymkRow) => {
    if (taken.has(r.id) || rows.length >= limit) return;
    taken.add(r.id);
    rows.push(r);
  };

  const related = viewer.personId ? await getRelated(viewer.personId, 12) : [];
  // The program's head coach: from the coaching tree for a coach, or directly for an athletic director.
  const head = viewer.headCoach
    ? (related.find((p) => p.id === viewer.headCoach!.id) ?? (viewer.personId ? undefined : (await getPeopleSummaries([viewer.headCoach.id])).get(viewer.headCoach.id)))
    : undefined;
  if (head) {
    push({
      id: head.id,
      slug: head.slug,
      fullName: head.fullName,
      title: cleanTitle(head.currentTitle) || null,
      orgShortName: head.org?.shortName ?? null,
      claimed: head.claimed,
      context: head.claimed ? "Your head coach" : "Your head coach · hasn't claimed a profile",
      contextKind: "info",
      known: true,
    });
  }

  // Two steps away: people who worked with the viewer's colleagues, newest overlap first, head coaches first.
  const colleagueIds = viewer.colleagues.map((c) => c.id);
  if (colleagueIds.length) {
    const edges = await db
      .select({
        mentorId: treeEdges.mentorId,
        menteeId: treeEdges.menteeId,
        endYear: treeEdges.endYear,
        orgShortName: organizations.shortName,
      })
      .from(treeEdges)
      .innerJoin(organizations, eq(organizations.id, treeEdges.orgId))
      .where(or(inArray(treeEdges.mentorId, colleagueIds), inArray(treeEdges.menteeId, colleagueIds)))
      .orderBy(sql`${treeEdges.endYear} desc nulls last`)
      .limit(400);
    const candidates = new Map<string, { via: string; org: string }>();
    for (const e of edges) {
      const colleagueSide = colleagueIds.includes(e.mentorId) ? e.mentorId : e.menteeId;
      const other = colleagueSide === e.mentorId ? e.menteeId : e.mentorId;
      if (exclude.has(other) || candidates.has(other)) continue;
      candidates.set(other, { via: colleagueSide, org: e.orgShortName });
    }
    if (candidates.size) {
      const ppl = await db
        .select(summaryCols)
        .from(people)
        .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
        .where(and(inArray(people.id, [...candidates.keys()]), eq(people.isDemo, false)));
      const order = [...candidates.keys()];
      ppl.sort((a, b) => (ROLE_RANK[a.roleGroup ?? "other"] ?? 4) - (ROLE_RANK[b.roleGroup ?? "other"] ?? 4) || order.indexOf(a.id) - order.indexOf(b.id));
      const p = ppl[0];
      if (p) {
        const c = candidates.get(p.id)!;
        const via = viewer.colleagues.find((x) => x.id === c.via);
        push({
          id: p.id,
          slug: p.slug,
          fullName: p.fullName,
          title: cleanTitle(p.currentTitle) || null,
          orgShortName: p.orgShortName,
          claimed: p.claimed,
          context: `Via ${via?.fullName ?? "a colleague"} · worked together at ${c.org}`,
          contextKind: "tree",
          known: false,
        });
      }
    }
  }

  // An alum of the viewer's school.
  const vSchool = schoolKey(viewer.almaMater);
  if (vSchool && viewer.almaMater) {
    const alumni = await db
      .select(summaryCols)
      .from(people)
      .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(and(ilike(people.almaMater, `%${schoolShort(viewer.almaMater).replace(/[%_]/g, "")}%`), eq(people.isDemo, false)))
      .limit(50);
    const match = alumni
      .filter((a) => !exclude.has(a.id) && !taken.has(a.id))
      .sort((a, b) => Number(b.orgLevel === FEED_LEVEL) - Number(a.orgLevel === FEED_LEVEL) || (ROLE_RANK[a.roleGroup ?? "other"] ?? 4) - (ROLE_RANK[b.roleGroup ?? "other"] ?? 4) || a.fullName.localeCompare(b.fullName));
    const a = match[0];
    if (a) {
      push({
        id: a.id,
        slug: a.slug,
        fullName: a.fullName,
        title: cleanTitle(a.currentTitle) || null,
        orgShortName: a.orgShortName,
        claimed: a.claimed,
        context: `${schoolShort(viewer.almaMater)} alum, like you`,
        contextKind: "school",
        known: false,
      });
    }
  }

  // Fallback: head coaches and coordinators elsewhere in the viewer's conference.
  if (rows.length < limit && viewer.org?.conference) {
    const conf = await db
      .select(summaryCols)
      .from(people)
      .innerJoin(organizations, eq(organizations.id, people.currentOrgId))
      .where(
        and(
          eq(organizations.conference, viewer.org.conference),
          ne(organizations.id, viewer.org.id),
          inArray(people.roleGroup, ["head_coach", "coordinator"]),
          eq(people.isDemo, false),
        ),
      )
      .orderBy(sql`case ${people.roleGroup} when 'head_coach' then 0 else 1 end`, organizations.shortName, people.fullName)
      .limit(12);
    for (const p of conf) {
      if (exclude.has(p.id)) continue;
      push({
        id: p.id,
        slug: p.slug,
        fullName: p.fullName,
        title: cleanTitle(p.currentTitle) || null,
        orgShortName: p.orgShortName,
        claimed: p.claimed,
        context: `${viewer.org.conferenceAbbr ?? "Conference"} · your conference`,
        contextKind: "conference",
        known: false,
      });
    }
  }

  // Last: other colleagues from the tree.
  for (const p of related) {
    if (rows.length >= limit) break;
    const c = viewer.colleagues.find((x) => x.id === p.id);
    push({
      id: p.id,
      slug: p.slug,
      fullName: p.fullName,
      title: cleanTitle(p.currentTitle) || null,
      orgShortName: p.org?.shortName ?? null,
      claimed: p.claimed,
      context: `Worked with you at ${c?.edgeOrgShortName ?? "your program"}${p.claimed ? "" : " · hasn't claimed a profile"}`,
      contextKind: "tree",
      known: true,
    });
  }
  return rows;
}

/* ---------- Mini profile ---------- */

export type MiniProfileStats = {
  profileViewers: number;
  searchAppearances: number;
  treeSize: number;
};

/** A stable demo number for a person (labelled "demo data" wherever it shows). */
function demoNumber(seed: string, min: number, span: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return min + (h % span);
}

/** Left-rail numbers: profile viewers (past 7 days), search appearances (demo) and the coaching-tree size. */
export async function getMiniProfileStats(viewer: FeedViewer): Promise<MiniProfileStats | null> {
  if (!viewer.personId) return null;
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [[views], [tree]] = await Promise.all([
    db
      .select({ n: sql<number>`count(distinct coalesce(${profileViews.viewerUserId}, ${profileViews.id}::text))::int` })
      .from(profileViews)
      .where(and(eq(profileViews.personId, viewer.personId), gte(profileViews.viewedAt, since))),
    db
      .select({ n: sql<number>`count(distinct case when ${treeEdges.mentorId} = ${viewer.personId} then ${treeEdges.menteeId} else ${treeEdges.mentorId} end)::int` })
      .from(treeEdges)
      .where(or(eq(treeEdges.mentorId, viewer.personId), eq(treeEdges.menteeId, viewer.personId))),
  ]);
  const seed = viewer.slug ?? viewer.personId;
  return {
    profileViewers: views?.n || demoNumber(`${seed}:views`, 24, 40),
    searchAppearances: demoNumber(`${seed}:search`, 80, 90),
    treeSize: tree?.n ?? 0,
  };
}
