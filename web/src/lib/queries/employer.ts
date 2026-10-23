import "server-only";
import { cache } from "react";
import { aliasedTable, and, asc, count, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { organizations, people, shortlistEntries, shortlists, tenures, treeEdges } from "@/db/schema";
import type { PipelineStage } from "@/components/employer/stages";
import { CURRENT_SEASON } from "@/lib/brand";
import { seasonRangeCompact, seasonRangeLabel, titleShort } from "@/lib/format";

/* ------------------------------------------------------------------ types */

/** One line of context on a candidate card (§8.3 ContextLine). */
export type CandidateContext = {
  /** tree = "Worked under …", previous = "Previously … at …", played = "Played at …". */
  kind: "tree" | "previous" | "played";
  /** The sentence without its years: "Worked under Greg Etter at Concordia (WI)". */
  text: string;
  /** Compact years ("2020–") when the source states them; null otherwise (never inferred). */
  years: string | null;
  /** Spoken form of the years for screen readers ("2020–Present, 7 seasons"). */
  yearsLabel: string | null;
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

/** The employer's searches (shortlists), oldest first, with how many candidates each holds. */
export async function getEmployerShortlists(userId: string): Promise<ShortlistSummary[]> {
  return db
    .select({ id: shortlists.id, name: shortlists.name, count: count(shortlistEntries.id) })
    .from(shortlists)
    .leftJoin(shortlistEntries, eq(shortlistEntries.shortlistId, shortlists.id))
    .where(eq(shortlists.ownerUserId, userId))
    .groupBy(shortlists.id)
    .orderBy(asc(shortlists.createdAt), asc(shortlists.id));
}

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
    .where(eq(shortlists.ownerUserId, userId))
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
  headCoach: { slug: string; fullName: string } | null;
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
    .select({ slug: people.slug, fullName: people.fullName })
    .from(people)
    .where(and(eq(people.currentOrgId, orgId), eq(people.roleGroup, "head_coach"), eq(people.isDemo, false)))
    .orderBy(asc(people.fullName))
    .limit(1);
  return { ...org, headCoach: head ?? null };
}

/* ---------------------------------------------------------------- context */

type ContextInput = { id: string; currentOrgId: string | null };

/**
 * A past title short enough for a one-line context: titleShort() abbreviations, and for long
 * combined titles ("Defensive Secondary Coach / Recruiting Coordinator") the first role only.
 */
function compactTitle(role: string): string {
  const t = titleShort(role, 30);
  if (t.length <= 36 || !t.includes("/")) return t;
  return t.split("/")[0].trim();
}

/**
 * Structured, sourced context for candidate cards. Never prose: each line is a fact from tree
 * edges or stints. Years appear only when the person's stint at that program states them.
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

    // 1. Tree: the most recent "worked under" edge, else the most recent "worked alongside".
    const under = edges.filter((e) => e.kind === "worked_under" && e.menteeId === c.id).sort((a, b) => span(b) - span(a))[0];
    const alongside = under
      ? undefined
      : edges.filter((e) => e.kind === "worked_alongside" && (e.menteeId === c.id || e.mentorId === c.id)).sort((a, b) => span(b) - span(a))[0];
    const edge = under ?? alongside;
    if (edge) {
      const other = under ? edge.mentorName : edge.mentorId === c.id ? edge.menteeName : edge.mentorName;
      const stated = edge.startYear != null && explicitAt.has(`${c.id}:${edge.orgId}`);
      const ongoing = c.currentOrgId === edge.orgId && (edge.endYear ?? 0) >= CURRENT_SEASON;
      // The card's role line already names the current program, so a tree edge there drops it.
      const where = edge.orgId === c.currentOrgId ? "" : ` at ${edge.orgShortName}`;
      lines.push({
        kind: "tree",
        text: `${under ? "Worked under" : "Worked alongside"} ${other}${where}`,
        years: stated ? seasonRangeCompact(edge.startYear, edge.endYear, ongoing) : null,
        yearsLabel: stated ? seasonRangeLabel(edge.startYear, edge.endYear, ongoing) : null,
      });
    }

    // 2. The most recent coaching stop before the current program.
    const mine = stints.filter((s) => s.personId === c.id);
    const previous = mine.find((s) => !s.asPlayer && !s.isCurrent && s.orgId !== c.currentOrgId);
    if (previous) {
      const stated = previous.yearsExplicit && previous.startYear != null;
      lines.push({
        kind: "previous",
        text: `Previously ${compactTitle(previous.role)} at ${previous.orgShortName}`,
        years: stated ? seasonRangeCompact(previous.startYear, previous.endYear, false) : null,
        yearsLabel: stated ? seasonRangeLabel(previous.startYear, previous.endYear, false) : null,
      });
    }

    // 3. Nothing else known: where they played, if the source says.
    if (!lines.length) {
      const played = mine.find((s) => s.asPlayer);
      if (played) {
        const stated = played.yearsExplicit && played.startYear != null;
        lines.push({
          kind: "played",
          text: `Played at ${played.orgShortName}`,
          years: stated ? seasonRangeCompact(played.startYear, played.endYear, false) : null,
          yearsLabel: stated ? seasonRangeLabel(played.startYear, played.endYear, false) : null,
        });
      }
    }
    out.set(c.id, lines);
  }
  return out;
}
