"use server";
import { revalidatePath } from "next/cache";
import { and, asc, count, eq, isNull, max, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { people, shortlistEntries, shortlists } from "@/db/schema";
import { searchDisplayName } from "@/components/employer/presets";
import { NOTE_MAX, PIPELINE_STAGES, type PipelineStage } from "@/components/employer/stages";
import {
  copyShortlistForScope,
  DEMO_PIPELINE_TTL_MS,
  DEMO_SEARCH_CANDIDATE_LIMIT,
  ensureDemoScope,
  readDemoScope,
  shortlistPublicId,
  touchScopedSearch,
  visibleShortlists,
} from "@/lib/demo-scope";
import { getSession } from "@/lib/session";

/**
 * Hiring pipeline mutations (DESIGN.md §8.14). Every action checks the demo session: only the
 * athletic director (employer) account can change a pipeline, and only its own searches.
 *
 * The athletic director demo is one account shared by every visitor, so its writes stay in the
 * browser that made them (lib/demo-scope.ts "pipeline"): a seeded search is never changed; the
 * browser's first write copies it into a search of its own and every write goes to that copy. Searches
 * keep their public ids (a copy goes by the seeded search's id); entry ids from a page loaded before
 * the copy was made still resolve, to the same candidate in the copy.
 */

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const PIPELINE_PATH = "/employers/pipeline";
const NOT_EMPLOYER = "Switch to the athletic director demo account to manage a hiring pipeline.";
const NOT_FOUND = "That candidate is no longer in your pipeline.";
const SEARCH_NOT_FOUND = "That hiring search could not be found.";
const DEMO_BUSY = "The demo pipeline is busy right now. Try again later.";
const SEARCH_FULL = `The demo holds up to ${DEMO_SEARCH_CANDIDATE_LIMIT} candidates per search. Remove one to add another.`;
const DEFAULT_SEARCH_NAME = "Shortlist";

const stageSchema = z.enum(PIPELINE_STAGES);
const entryIdSchema = z.number().int().positive().max(2_147_483_647);
const personIdSchema = z.string().trim().min(1).max(200);
const positionSchema = z.number().int().min(0).max(1_000_000);

type Employer = { userId: string; demo: boolean };

async function currentEmployer(): Promise<Employer | null> {
  const session = await getSession();
  return session?.user.kind === "employer" ? { userId: session.user.id, demo: session.user.isDemo } : null;
}

/** A search as an action sees it: the stored row (`id`) and the id the page and URLs use (`publicId`). */
type Search = { id: number; publicId: number; name: string; demoScope: string | null };

const searchColumns = () => ({ id: shortlists.id, publicId: shortlistPublicId(), name: shortlists.name, demoScope: shortlists.demoScope });

/**
 * One of this user's searches by its public id, as this browser sees it: a seeded search, or this
 * browser's own (its copy of a seeded search, or the search opened with one of its demo listings).
 */
async function visibleSearch(publicId: number, userId: string): Promise<Search | null> {
  const [row] = await db
    .select(searchColumns())
    .from(shortlists)
    .where(and(eq(shortlistPublicId(), publicId), eq(shortlists.ownerUserId, userId), await visibleShortlists()))
    .limit(1);
  return row ?? null;
}

/**
 * Where a write to a search goes. Outside the demo, the search itself. In a demo session, the
 * browser's own search: a seeded search is copied for this browser first (lib/demo-scope.ts).
 */
async function writableSearch(search: Search, employer: Employer): Promise<ActionResult<{ search: Search }>> {
  if (!employer.demo) return { ok: true, search };
  if (search.demoScope) {
    await touchScopedSearch(search.id);
    return { ok: true, search };
  }
  const scope = await ensureDemoScope();
  const copy = await copyShortlistForScope(search.id, scope);
  if (!copy.ok) return { ok: false, error: copy.reason === "full" ? DEMO_BUSY : SEARCH_NOT_FOUND };
  return { ok: true, search: { ...search, id: copy.id, demoScope: scope } };
}

type Entry = {
  id: number;
  shortlistId: number;
  publicListId: number;
  listName: string;
  listScope: string | null;
  personId: string;
  stage: PipelineStage;
  note: string | null;
  position: number;
};

const entryColumns = () => ({
  id: shortlistEntries.id,
  shortlistId: shortlistEntries.shortlistId,
  publicListId: shortlistPublicId(),
  listName: shortlists.name,
  listScope: shortlists.demoScope,
  personId: shortlistEntries.personId,
  stage: shortlistEntries.stage,
  note: shortlistEntries.note,
  position: shortlistEntries.position,
});

/**
 * An entry in one of this user's searches that this browser may touch: a seeded search or one of its
 * own, never another browser's. An entry of a seeded search this browser has since copied still
 * resolves (a page loaded before the copy holds its id); writableEntry maps it to the copy.
 */
async function ownedEntry(entryId: number, userId: string): Promise<Entry | null> {
  const scope = await readDemoScope();
  const [row] = await db
    .select(entryColumns())
    .from(shortlistEntries)
    .innerJoin(shortlists, eq(shortlists.id, shortlistEntries.shortlistId))
    .where(
      and(
        eq(shortlistEntries.id, entryId),
        eq(shortlists.ownerUserId, userId),
        scope ? or(isNull(shortlists.demoScope), eq(shortlists.demoScope, scope)) : isNull(shortlists.demoScope),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The entry a write goes to: in a demo session, the same candidate in this browser's own search. */
async function writableEntry(entry: Entry, employer: Employer): Promise<ActionResult<{ entry: Entry }>> {
  if (!employer.demo) return { ok: true, entry };
  if (entry.listScope) {
    await touchScopedSearch(entry.shortlistId);
    return { ok: true, entry };
  }
  const target = await writableSearch({ id: entry.shortlistId, publicId: entry.publicListId, name: entry.listName, demoScope: null }, employer);
  if (!target.ok) return target;
  const [copy] = await db
    .select(entryColumns())
    .from(shortlistEntries)
    .innerJoin(shortlists, eq(shortlists.id, shortlistEntries.shortlistId))
    .where(and(eq(shortlistEntries.shortlistId, target.search.id), eq(shortlistEntries.personId, entry.personId)))
    .limit(1);
  return copy ? { ok: true, entry: copy } : { ok: false, error: NOT_FOUND };
}

/** The entry for a person in a search (the unique pair shortlist_entries_list_person_idx). */
async function entryFor(shortlistId: number, personId: string) {
  const [row] = await db
    .select({ id: shortlistEntries.id, stage: shortlistEntries.stage })
    .from(shortlistEntries)
    .where(and(eq(shortlistEntries.shortlistId, shortlistId), eq(shortlistEntries.personId, personId)))
    .limit(1);
  return row ?? null;
}

/** Next position at the end of a stage column. */
async function endOfStage(shortlistId: number, stage: PipelineStage): Promise<number> {
  const [row] = await db
    .select({ max: max(shortlistEntries.position) })
    .from(shortlistEntries)
    .where(and(eq(shortlistEntries.shortlistId, shortlistId), eq(shortlistEntries.stage, stage)));
  return (row?.max ?? -1) + 1;
}

/** A scoped (demo) search holds at most DEMO_SEARCH_CANDIDATE_LIMIT candidates. */
async function isFull(search: Search): Promise<boolean> {
  if (!search.demoScope) return false;
  const [row] = await db.select({ n: count() }).from(shortlistEntries).where(eq(shortlistEntries.shortlistId, search.id));
  return (row?.n ?? 0) >= DEMO_SEARCH_CANDIDATE_LIMIT;
}

/**
 * Adds a coach to the employer's pipeline in Sourced (the first search, or `shortlistId`). Creates
 * a search when the employer has none. Adding someone already in the search is a no-op that
 * reports where they are. `shortlistLabel` is the search's name as the page shows it (no
 * "(demo)" suffix, which the page's Demo chip carries).
 */
export async function addToPipeline(
  personId: string,
  shortlistId?: number,
): Promise<ActionResult<{ entryId: number; stage: PipelineStage; shortlistId: number; shortlistName: string; shortlistLabel: string; alreadyAdded: boolean }>> {
  const employer = await currentEmployer();
  if (!employer) return { ok: false, error: NOT_EMPLOYER };
  const { userId } = employer;
  const pid = personIdSchema.safeParse(personId);
  if (!pid.success) return { ok: false, error: "That coach could not be found." };
  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, pid.data)).limit(1);
  if (!person) return { ok: false, error: "That coach could not be found." };

  let list: Search | null = null;
  if (shortlistId != null) {
    const id = entryIdSchema.safeParse(shortlistId);
    list = id.success ? await visibleSearch(id.data, userId) : null;
    if (!list) return { ok: false, error: SEARCH_NOT_FOUND };
  } else {
    [list] = await db
      .select(searchColumns())
      .from(shortlists)
      .where(and(eq(shortlists.ownerUserId, userId), await visibleShortlists()))
      .orderBy(asc(shortlists.createdAt), asc(shortlistPublicId()))
      .limit(1);
    if (!list) {
      // A demo session's new search belongs to this browser, like everything else it writes.
      const scope = employer.demo ? await ensureDemoScope() : null;
      const [made] = await db
        .insert(shortlists)
        .values({ ownerUserId: userId, name: DEFAULT_SEARCH_NAME, demoScope: scope, demoExpiresAt: scope ? new Date(Date.now() + DEMO_PIPELINE_TTL_MS) : null })
        .returning({ id: shortlists.id, name: shortlists.name, demoScope: shortlists.demoScope });
      list = { ...made, publicId: made.id };
    }
  }

  const search: Search = list;
  const shortlistLabel = searchDisplayName(search.name);
  const done = (entryId: number, stage: PipelineStage, alreadyAdded: boolean) =>
    ({ ok: true, entryId, stage, shortlistId: search.publicId, shortlistName: search.name, shortlistLabel, alreadyAdded }) as const;

  const existing = await entryFor(search.id, person.id);
  if (existing) return done(existing.id, existing.stage, true);

  const target = await writableSearch(search, employer);
  if (!target.ok) return target;
  const into = target.search;
  if (await isFull(into)) return { ok: false, error: SEARCH_FULL };

  // Two adds can race (double click, two tabs): the unique (search, person) index keeps one row, and
  // the loser reports the winner's entry.
  const position = await endOfStage(into.id, "sourced");
  const [entry] = await db
    .insert(shortlistEntries)
    .values({ shortlistId: into.id, personId: person.id, stage: "sourced", position })
    .onConflictDoNothing({ target: [shortlistEntries.shortlistId, shortlistEntries.personId] })
    .returning({ id: shortlistEntries.id });
  if (!entry) {
    const winner = await entryFor(into.id, person.id);
    if (!winner) return { ok: false, error: "That coach could not be added. Try again." };
    return done(winner.id, winner.stage, true);
  }
  revalidatePath(PIPELINE_PATH);
  return done(entry.id, "sourced", false);
}

/**
 * Moves a candidate to another stage: to the end of that column, or to `position` (Undo puts a
 * card back where it was).
 */
export async function moveCandidate(
  entryId: number,
  stage: PipelineStage,
  position?: number,
): Promise<ActionResult<{ stage: PipelineStage; previousStage: PipelineStage; previousPosition: number }>> {
  const employer = await currentEmployer();
  if (!employer) return { ok: false, error: NOT_EMPLOYER };
  const id = entryIdSchema.safeParse(entryId);
  const to = stageSchema.safeParse(stage);
  const at = positionSchema.optional().safeParse(position);
  if (!id.success || !to.success || !at.success) return { ok: false, error: "That move is not possible." };
  const found = await ownedEntry(id.data, employer.userId);
  if (!found) return { ok: false, error: NOT_FOUND };
  const target = await writableEntry(found, employer);
  if (!target.ok) return target;
  const entry = target.entry;
  if (entry.stage !== to.data) {
    const next = at.data ?? (await endOfStage(entry.shortlistId, to.data));
    await db.update(shortlistEntries).set({ stage: to.data, position: next }).where(eq(shortlistEntries.id, entry.id));
    revalidatePath(PIPELINE_PATH);
  }
  return { ok: true, stage: to.data, previousStage: entry.stage, previousPosition: entry.position };
}

/** Adds, edits or (with an empty note) clears the candidate's note. */
export async function saveCandidateNote(entryId: number, note: string): Promise<ActionResult<{ note: string | null }>> {
  const employer = await currentEmployer();
  if (!employer) return { ok: false, error: NOT_EMPLOYER };
  const id = entryIdSchema.safeParse(entryId);
  const text = z.string().max(NOTE_MAX).safeParse(note ?? "");
  if (!id.success) return { ok: false, error: NOT_FOUND };
  if (!text.success) return { ok: false, error: `Keep the note under ${NOTE_MAX.toLocaleString("en-US")} characters.` };
  const found = await ownedEntry(id.data, employer.userId);
  if (!found) return { ok: false, error: NOT_FOUND };
  const target = await writableEntry(found, employer);
  if (!target.ok) return target;
  const value = text.data.trim() ? text.data.trim() : null;
  await db.update(shortlistEntries).set({ note: value }).where(eq(shortlistEntries.id, target.entry.id));
  revalidatePath(PIPELINE_PATH);
  return { ok: true, note: value };
}

/** What a removed entry looked like, so the "Undo" in the toast can put it back. */
export type RemovedCandidate = { shortlistId: number; personId: string; stage: PipelineStage; note: string | null; position: number };

/** Removes a candidate from the search. Returns the entry so it can be restored. */
export async function removeFromPipeline(entryId: number): Promise<ActionResult<{ removed: RemovedCandidate }>> {
  const employer = await currentEmployer();
  if (!employer) return { ok: false, error: NOT_EMPLOYER };
  const id = entryIdSchema.safeParse(entryId);
  if (!id.success) return { ok: false, error: NOT_FOUND };
  const found = await ownedEntry(id.data, employer.userId);
  if (!found) return { ok: false, error: NOT_FOUND };
  const target = await writableEntry(found, employer);
  if (!target.ok) return target;
  const entry = target.entry;
  await db.delete(shortlistEntries).where(eq(shortlistEntries.id, entry.id));
  revalidatePath(PIPELINE_PATH);
  return { ok: true, removed: { shortlistId: entry.publicListId, personId: entry.personId, stage: entry.stage, note: entry.note, position: entry.position } };
}

/** Undo for removeFromPipeline: puts the candidate back where they were, with their note. */
export async function restoreCandidate(removed: RemovedCandidate): Promise<ActionResult<{ entryId: number }>> {
  const employer = await currentEmployer();
  if (!employer) return { ok: false, error: NOT_EMPLOYER };
  const parsed = z
    .object({
      shortlistId: entryIdSchema,
      personId: personIdSchema,
      stage: stageSchema,
      note: z.string().max(NOTE_MAX).nullable(),
      position: positionSchema,
    })
    .safeParse(removed);
  if (!parsed.success) return { ok: false, error: "That candidate could not be restored." };
  const r = parsed.data;
  const list = await visibleSearch(r.shortlistId, employer.userId);
  if (!list) return { ok: false, error: SEARCH_NOT_FOUND };
  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, r.personId)).limit(1);
  if (!person) return { ok: false, error: "That coach could not be found." };
  try {
    const existing = await entryFor(list.id, person.id);
    if (existing) return { ok: true, entryId: existing.id };
    const target = await writableSearch(list, employer);
    if (!target.ok) return target;
    const into = target.search;
    if (await isFull(into)) return { ok: false, error: SEARCH_FULL };
    const [entry] = await db
      .insert(shortlistEntries)
      .values({ shortlistId: into.id, personId: person.id, stage: r.stage, note: r.note, position: r.position })
      .onConflictDoNothing({ target: [shortlistEntries.shortlistId, shortlistEntries.personId] })
      .returning({ id: shortlistEntries.id });
    const id = entry?.id ?? (await entryFor(into.id, person.id))?.id;
    if (!id) return { ok: false, error: "That candidate could not be restored." };
    revalidatePath(PIPELINE_PATH);
    return { ok: true, entryId: id };
  } catch {
    return { ok: false, error: "That candidate could not be restored." };
  }
}
