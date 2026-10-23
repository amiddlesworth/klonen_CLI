import "server-only";
import { cache } from "react";
import { aliasedTable, and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, shortlistEntries, shortlists, tenures, treeEdges } from "@/db/schema";
import type { PresetCriteria } from "@/components/employer/presets";
import type { PipelineStage } from "@/components/employer/stages";
import { atProgram, keepTogether, possessive, previouslyAt, programBudget } from "@/components/employer/text";
import { CURRENT_SEASON } from "@/lib/brand";
import { seasonRangeCompact, seasonRangeLabel } from "@/lib/format";
import { escapeLike } from "@/lib/queries/orgs";
import { countPeople } from "@/lib/queries/searchx";
import { visibleShortlists } from "@/lib/demo-scope";

/* ------------------------------------------------------------------ types */

/** One line of context on a candidate card (§8.3 ContextLine). */
export type CandidateContext = {
  /** tree = "Worked under …" / "On …'s current staff", previous = "Previously … at …", played = "Played at …". */
  kind: "tree" | "previous" | "played";
  /** The sentence without its years, as shown: "Previously GA (Defense) at Fairleigh Dickinson‑Florham". */
  text: string;
  /** The same sentence with the title unabbreviated, for screen readers and hover; null when identical. */
  fullText: string | null;
  /** Compact years ("2020–22", or "2024" after "since") when the source states them; null when absent or inferred. */
  years: string | null;
  /** Spoken form of the years for screen readers ("2020–2022, 3 seasons"). */
  yearsLabel: string | null;
  /** "since": the years follow as "since 2024"; "list": they follow a comma (", 2020–22"). */
  yearsJoin: "since" | "list";
};

export type Candidate = {
  entryId: number;
  stage: PipelineStage;
  note: string | null;
  position: number;
  person: {
    id: string;
    slug: string;
    fullName: string;
    currentTitle: string | null;
    isDemo: boolean;
    org: { slug: string; shortName: string; inRegistry: boolean } | null;
  };
  /** Up to two lines: tree context first, then the previous stop (or where they played). */
  context: CandidateContext[];
};

export type ShortlistSummary = { id: number; name: string; count: number };

export type PipelineData = {
  /** Every search this employer owns, oldest first, with candidate counts (the switcher). */
  shortlists: ShortlistSummary[];
  /** The search on screen; null when the employer has none, or the requested one is not theirs. */
  shortlist: { id: number; name: string } | null;
  candidates: Candidate[];
};

export type PipelineStatus = { entryId: number; stage: PipelineStage; shortlistId: number; shortlistName: string };

/* ---------------------------------------------------------------- queries */

/**
 * The employer's searches (shortlists), oldest first, with how many candidates each holds. Cached
 * per request: the page checks `?list=` ownership with it before the board streams.
 */
export const getEmployerShortlists = cache(async (userId: string): Promise<ShortlistSummary[]> => {
  return db
    .select({ id: shortlists.id, name: shortlists.name, count: count(shortlistEntries.id) })
    .from(shortlists)
    .leftJoin(shortlistEntries, eq(shortlistEntries.shortlistId, shortlists.id))
    .where(and(eq(shortlists.ownerUserId, userId), await visibleShortlists()))
    .groupBy(shortlists.id)
    .orderBy(asc(shortlists.createdAt), asc(shortlists.id));
});

/**
 * The hiring pipeline for one of the employer's searches (default: the first one). Cached per
 * request so generateMetadata and the page share one read.
 */
export const getPipeline = cache(async (userId: string, listId?: number | null): Promise<PipelineData> => {
  const lists = await getEmployerShortlists(userId);
  const current = listId != null ? lists.find((l) => l.id === listId) : lists[0];
  if (!current) return { shortlists: lists, shortlist: null, candidates: [] };

  const rows = await db
    .select({
      entryId: shortlistEntries.id,
      stage: shortlistEntries.stage,
      note: shortlistEntries.note,
      position: shortlistEntries.position,
      personId: people.id,
      slug: people.slug,
      fullName: people.fullName,
      currentTitle: people.currentTitle,
      isDemo: people.isDemo,
      currentOrgId: people.currentOrgId,
      orgSlug: organizations.slug,
      orgShortName: organizations.shortName,
      orgInRegistry: organizations.inRegistry,
    })
    .from(shortlistEntries)
    .innerJoin(people, eq(people.id, shortlistEntries.personId))
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .where(eq(shortlistEntries.shortlistId, current.id))
    .orderBy(asc(shortlistEntries.position), asc(shortlistEntries.id));

  const context = await getCandidateContext(rows.map((r) => ({ id: r.personId, currentOrgId: r.currentOrgId })));

  return {
    shortlists: lists,
    shortlist: { id: current.id, name: current.name },
    candidates: rows.map((r) => ({
      entryId: r.entryId,
      stage: r.stage,
      note: r.note?.trim() ? r.note : null,
      position: r.position,
      person: {
        id: r.personId,
        slug: r.slug,
        fullName: r.fullName,
        currentTitle: r.currentTitle,
        isDemo: r.isDemo,
        org: r.orgSlug ? { slug: r.orgSlug, shortName: r.orgShortName!, inRegistry: r.orgInRegistry ?? false } : null,
      },
      context: context.get(r.personId) ?? [],
    })),
  };
});

/**
 * Where each person already sits in this employer's pipeline (first search wins). Cached per
 * request, so a page of AddToPipelineButtons reads it once.
 */
export const getPipelineStatusMap = cache(async (userId: string): Promise<Map<string, PipelineStatus>> => {
  const rows = await db
    .select({
      personId: shortlistEntries.personId,
      entryId: shortlistEntries.id,
      stage: shortlistEntries.stage,
      shortlistId: shortlists.id,
      shortlistName: shortlists.name,
    })
    .from(shortlistEntries)
    .innerJoin(shortlists, eq(shortlists.id, shortlistEntries.shortlistId))
    .where(and(eq(shortlists.ownerUserId, userId), await visibleShortlists()))
    .orderBy(asc(shortlists.createdAt), asc(shortlists.id));
  const map = new Map<string, PipelineStatus>();
  for (const r of rows) if (!map.has(r.personId)) map.set(r.personId, { entryId: r.entryId, stage: r.stage, shortlistId: r.shortlistId, shortlistName: r.shortlistName });
  return map;
});

/** A person's name for labels and toasts (null when the id is unknown). */
export const getPersonName = cache(async (personId: string): Promise<string | null> => {
  const [row] = await db.select({ fullName: people.fullName }).from(people).where(eq(people.id, personId)).limit(1);
  return row?.fullName ?? null;
});

export type EmployerProgram = {
  shortName: string;
  level: string | null;
  conferenceAbbr: string | null;
  headCoach: { id: string; slug: string; fullName: string } | null;
};

/** The employer's own program, for the "Find candidates" presets (its conference, its head coach's tree). */
export async function getEmployerProgram(orgId: string | null | undefined): Promise<EmployerProgram | null> {
  if (!orgId) return null;
  const [org] = await db
    .select({ shortName: organizations.shortName, level: organizations.level, conferenceAbbr: organizations.conferenceAbbr })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) return null;
  const [head] = await db
    .select({ id: people.id, slug: people.slug, fullName: people.fullName })
    .from(people)
    .where(and(eq(people.currentOrgId, orgId), eq(people.roleGroup, "head_coach"), eq(people.isDemo, false)))
    .orderBy(asc(people.fullName))
    .limit(1);
  return { ...org, headCoach: head ?? null };
}

/**
 * How many coaches each search returns, counted by the search feature itself (same criteria, same
 * SQL as /search), so the pipeline never links to an empty result.
 */
export async function countPeopleSearches(criteria: PresetCriteria[]): Promise<number[]> {
  return Promise.all(criteria.map((c) => countPeople(c).catch(() => 0)));
}

/** A coach offered in the "Add candidate" dialog. */
export type CandidateOption = {
  id: string;
  slug: string;
  fullName: string;
  currentTitle: string | null;
  orgShortName: string | null;
  isDemo: boolean;
  /** Where the coach already sits in this search, if anywhere. */
  stage: PipelineStage | null;
};

/** How many coaches the "Add candidate" dialog lists at once. */
export const CANDIDATE_OPTION_LIMIT = 8;

/**
 * Coaches whose name or current program matches `term` (2+ characters), for the "Add candidate"
 * dialog: name matches first (exact, prefix, word prefix), then program matches; real records
 * before demo ones. Reads one row past the limit so the dialog can say when there are more.
 * `shortlistId` must already be checked as the caller's.
 */
export async function searchCandidateOptions(term: string, shortlistId: number | null): Promise<{ options: CandidateOption[]; more: boolean }> {
  const t = term.trim().slice(0, 80);
  if (t.length < 2) return { options: [], more: false };
  const e = escapeLike(t);
  const rank = sql`case
    when lower(${people.fullName}) = ${t.toLowerCase()} then 0
    when ${people.fullName} ilike ${`${e}%`} then 1
    when ${people.fullName} ilike ${`% ${e}%`} or ${people.fullName} ilike ${`%-${e}%`} then 2
    when ${people.fullName} ilike ${`%${e}%`} then 3
    else 4 end`;
  const roleOrder = sql`case ${people.roleGroup} when 'head_coach' then 0 when 'coordinator' then 1 when 'position_coach' then 2 when 'ga_analyst' then 3 else 4 end`;
  const rows = await db
    .select({
      id: people.id,
      slug: people.slug,
      fullName: people.fullName,
      currentTitle: people.currentTitle,
      orgShortName: organizations.shortName,
      isDemo: people.isDemo,
      stage: shortlistEntries.stage,
    })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.currentOrgId))
    .leftJoin(shortlistEntries, and(eq(shortlistEntries.personId, people.id), eq(shortlistEntries.shortlistId, shortlistId ?? -1)))
    .where(or(ilike(people.fullName, `%${e}%`), ilike(organizations.shortName, `%${e}%`), ilike(organizations.name, `%${e}%`)))
    .orderBy(rank, people.isDemo, roleOrder, asc(people.fullName), asc(people.id))
    .limit(CANDIDATE_OPTION_LIMIT + 1);
  return {
    options: rows.slice(0, CANDIDATE_OPTION_LIMIT).map((r) => ({ ...r, stage: r.stage ?? null })),
    more: rows.length > CANDIDATE_OPTION_LIMIT,
  };
}

/* ---------------------------------------------------------------- context */

type ContextInput = { id: string; currentOrgId: string | null };

/**
 * Structured, sourced context for candidate cards. Never prose: each line is a fact from tree
 * edges or stints. Years appear only when they are stated: for a stint, the person's own stint
 * states them; for a tree edge (the overlap of two stints), the candidate's stint there states
 * them and neither person has an inferred stint at that program (the check /search makes).
 */
async function getCandidateContext(candidates: ContextInput[]): Promise<Map<string, CandidateContext[]>> {
  const ids = candidates.map((c) => c.id);
  const out = new Map<string, CandidateContext[]>();
  if (!ids.length) return out;

  const mentor = aliasedTable(people, "ctx_mentor");
  const mentee = aliasedTable(people, "ctx_mentee");
  const edgeOrg = aliasedTable(organizations, "ctx_edge_org");
  const stintOrg = aliasedTable(organizations, "ctx_stint_org");

  const [edges, stints] = await Promise.all([
    db
      .select({
        kind: treeEdges.kind,
        mentorId: treeEdges.mentorId,
        menteeId: treeEdges.menteeId,
        orgId: treeEdges.orgId,
        startYear: treeEdges.startYear,
        endYear: treeEdges.endYear,
        mentorName: mentor.fullName,
        menteeName: mentee.fullName,
        orgShortName: edgeOrg.shortName,
        inferred: sql<boolean>`exists (select 1 from ${tenures} where ${tenures.orgId} = ${treeEdges.orgId} and ${tenures.asPlayer} = false and ${tenures.yearsExplicit} = false and ${tenures.personId} in (${treeEdges.mentorId}, ${treeEdges.menteeId}))`,
      })
      .from(treeEdges)
      .innerJoin(mentor, eq(mentor.id, treeEdges.mentorId))
      .innerJoin(mentee, eq(mentee.id, treeEdges.menteeId))
      .innerJoin(edgeOrg, eq(edgeOrg.id, treeEdges.orgId))
      .where(or(inArray(treeEdges.menteeId, ids), and(eq(treeEdges.kind, "worked_alongside"), inArray(treeEdges.mentorId, ids)))),
    db
      .select({
        personId: tenures.personId,
        orgId: tenures.orgId,
        role: tenures.role,
        startYear: tenures.startYear,
        endYear: tenures.endYear,
        isCurrent: tenures.isCurrent,
        asPlayer: tenures.asPlayer,
        yearsExplicit: tenures.yearsExplicit,
        orgShortName: stintOrg.shortName,
      })
      .from(tenures)
      .innerJoin(stintOrg, eq(stintOrg.id, tenures.orgId))
      .where(inArray(tenures.personId, ids))
      .orderBy(asc(tenures.personId), asc(tenures.sortOrder)),
  ]);

  // Programs where a person's coaching years are stated in the source (edge years come from these stints).
  const explicitAt = new Set(stints.filter((s) => !s.asPlayer && s.yearsExplicit && s.startYear).map((s) => `${s.personId}:${s.orgId}`));
  const span = (e: { startYear: number | null; endYear: number | null }) => (e.endYear ?? 0) * 100 + ((e.endYear ?? 0) - (e.startYear ?? e.endYear ?? 0));

  for (const c of candidates) {
    const lines: CandidateContext[] = [];

    // 1. Tree: the most recent "worked under" edge, else the most recent "worked alongside" at an
    //    earlier program (colleagues on the current staff say nothing the role line doesn't).
    const under = edges.filter((e) => e.kind === "worked_under" && e.menteeId === c.id).sort((a, b) => span(b) - span(a))[0];
    const alongside = under
      ? undefined
      : edges
          .filter((e) => e.kind === "worked_alongside" && (e.menteeId === c.id || e.mentorId === c.id) && e.orgId !== c.currentOrgId)
          .sort((a, b) => span(b) - span(a))[0];
    const edge = under ?? alongside;
    if (edge) {
      const other = under ? edge.mentorName : edge.mentorId === c.id ? edge.menteeName : edge.mentorName;
      const stated = edge.startYear != null && !edge.inferred && explicitAt.has(`${c.id}:${edge.orgId}`);
      const atCurrent = edge.orgId === c.currentOrgId;
      if (under && atCurrent && (edge.endYear ?? 0) >= CURRENT_SEASON) {
        // Still on that head coach's staff: the search feature's words for it. The role line already
        // names the program.
        lines.push({
          kind: "tree",
          text: stated ? `On ${possessive(other)} staff` : `On ${possessive(other)} current staff`,
          fullText: null,
          years: stated ? String(edge.startYear) : null,
          yearsLabel: stated ? String(edge.startYear) : null,
          yearsJoin: "since",
        });
      } else {
        const who = `${under ? "Worked under" : "Worked alongside"} ${other}`;
        const years = stated ? seasonRangeCompact(edge.startYear, edge.endYear, false) : null;
        lines.push({
          kind: "tree",
          text: atCurrent ? who : atProgram(who, edge.orgShortName, programBudget(years)),
          fullText: null,
          years,
          yearsLabel: stated ? seasonRangeLabel(edge.startYear, edge.endYear, false) : null,
          yearsJoin: "list",
        });
      }
    }

    // 2. The most recent coaching stop before the current program.
    const mine = stints.filter((s) => s.personId === c.id);
    const previous = mine.find((s) => !s.asPlayer && !s.isCurrent && s.orgId !== c.currentOrgId);
    if (previous) {
      const stated = previous.yearsExplicit && previous.startYear != null;
      const years = stated ? seasonRangeCompact(previous.startYear, previous.endYear, false) : null;
      const text = previouslyAt(previous.role, previous.orgShortName, years);
      const fullText = `Previously ${previous.role} at ${previous.orgShortName}`;
      lines.push({
        kind: "previous",
        text,
        fullText: fullText === text.replace(/\u00A0/g, " ").replace(/\u2011/g, "-") ? null : fullText,
        years,
        yearsLabel: stated ? seasonRangeLabel(previous.startYear, previous.endYear, false) : null,
        yearsJoin: "list",
      });
    }

    // 3. Nothing else known: where they played, if the source says.
    if (!lines.length) {
      const played = mine.find((s) => s.asPlayer);
      if (played) {
        const stated = played.yearsExplicit && played.startYear != null;
        const years = stated ? seasonRangeCompact(played.startYear, played.endYear, false) : null;
        lines.push({
          kind: "played",
          text: `Played at ${keepTogether(played.orgShortName, programBudget(years))}`,
          fullText: null,
          years,
          yearsLabel: stated ? seasonRangeLabel(played.startYear, played.endYear, false) : null,
          yearsJoin: "list",
        });
      }
    }
    out.set(c.id, lines);
  }
  return out;
}
