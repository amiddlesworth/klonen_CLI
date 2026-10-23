"use server";
import { revalidatePath } from "next/cache";
import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { people, shortlistEntries, shortlists } from "@/db/schema";
import { NOTE_MAX, PIPELINE_STAGES, type PipelineStage } from "@/components/employer/stages";
import { getSession } from "@/lib/session";

/**
 * Hiring pipeline mutations (DESIGN.md §8.14). Every action checks the demo session: only the
 * athletic director (employer) account can change a pipeline, and only its own searches.
 */

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const PIPELINE_PATH = "/employers/pipeline";
const NOT_EMPLOYER = "Switch to the athletic director demo account to manage a hiring pipeline.";
const NOT_FOUND = "That candidate is no longer in your pipeline.";
const DEFAULT_SEARCH_NAME = "Shortlist";

const stageSchema = z.enum(PIPELINE_STAGES);
const entryIdSchema = z.number().int().positive();
const personIdSchema = z.string().trim().min(1).max(200);

async function employerUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.kind === "employer" ? session.user.id : null;
}

/** An entry, only when it belongs to one of this user's searches. */
async function ownedEntry(entryId: number, userId: string) {
  const [row] = await db
    .select({
      id: shortlistEntries.id,
      shortlistId: shortlistEntries.shortlistId,
      personId: shortlistEntries.personId,
      stage: shortlistEntries.stage,
      note: shortlistEntries.note,
      position: shortlistEntries.position,
    })
    .from(shortlistEntries)
    .innerJoin(shortlists, eq(shortlists.id, shortlistEntries.shortlistId))
    .where(and(eq(shortlistEntries.id, entryId), eq(shortlists.ownerUserId, userId)))
    .limit(1);
  return row ?? null;
}

async function ownedShortlist(shortlistId: number, userId: string) {
  const [row] = await db
    .select({ id: shortlists.id, name: shortlists.name })
    .from(shortlists)
    .where(and(eq(shortlists.id, shortlistId), eq(shortlists.ownerUserId, userId)))
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

/**
 * Adds a coach to the employer's pipeline in Sourced (the first search, or `shortlistId`). Creates
 * a search when the employer has none. Adding someone already in the search is a no-op that
 * reports where they are.
 */
export async function addToPipeline(
  personId: string,
  shortlistId?: number,
): Promise<ActionResult<{ entryId: number; stage: PipelineStage; shortlistId: number; shortlistName: string; alreadyAdded: boolean }>> {
  const userId = await employerUserId();
  if (!userId) return { ok: false, error: NOT_EMPLOYER };
  const pid = personIdSchema.safeParse(personId);
  if (!pid.success) return { ok: false, error: "That coach could not be found." };
  const [person] = await db.select({ id: people.id }).from(people).where(eq(people.id, pid.data)).limit(1);
  if (!person) return { ok: false, error: "That coach could not be found." };

  let list: { id: number; name: string } | null = null;
  if (shortlistId != null) {
    const id = entryIdSchema.safeParse(shortlistId);
    list = id.success ? await ownedShortlist(id.data, userId) : null;
    if (!list) return { ok: false, error: "That hiring search could not be found." };
  } else {
    [list] = await db
      .select({ id: shortlists.id, name: shortlists.name })
      .from(shortlists)
      .where(eq(shortlists.ownerUserId, userId))
      .orderBy(asc(shortlists.createdAt), asc(shortlists.id))
      .limit(1);
    if (!list) [list] = await db.insert(shortlists).values({ ownerUserId: userId, name: DEFAULT_SEARCH_NAME }).returning({ id: shortlists.id, name: shortlists.name });
  }

  const [existing] = await db
    .select({ id: shortlistEntries.id, stage: shortlistEntries.stage })
    .from(shortlistEntries)
    .where(and(eq(shortlistEntries.shortlistId, list.id), eq(shortlistEntries.personId, person.id)))
    .limit(1);
  if (existing) return { ok: true, entryId: existing.id, stage: existing.stage, shortlistId: list.id, shortlistName: list.name, alreadyAdded: true };

  const position = await endOfStage(list.id, "sourced");
  const [entry] = await db
    .insert(shortlistEntries)
    .values({ shortlistId: list.id, personId: person.id, stage: "sourced", position })
    .returning({ id: shortlistEntries.id });
  revalidatePath(PIPELINE_PATH);
  return { ok: true, entryId: entry.id, stage: "sourced", shortlistId: list.id, shortlistName: list.name, alreadyAdded: false };
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
  const userId = await employerUserId();
  if (!userId) return { ok: false, error: NOT_EMPLOYER };
  const id = entryIdSchema.safeParse(entryId);
  const to = stageSchema.safeParse(stage);
  const at = z.number().int().min(0).max(1_000_000).optional().safeParse(position);
  if (!id.success || !to.success || !at.success) return { ok: false, error: "That move is not possible." };
  const entry = await ownedEntry(id.data, userId);
  if (!entry) return { ok: false, error: NOT_FOUND };
  if (entry.stage !== to.data) {
    const next = at.data ?? (await endOfStage(entry.shortlistId, to.data));
    await db.update(shortlistEntries).set({ stage: to.data, position: next }).where(eq(shortlistEntries.id, entry.id));
    revalidatePath(PIPELINE_PATH);
  }
  return { ok: true, stage: to.data, previousStage: entry.stage, previousPosition: entry.position };
}

/** Adds, edits or (with an empty note) clears the candidate's note. */
export async function saveCandidateNote(entryId: number, note: string): Promise<ActionResult<{ note: string | null }>> {
  const userId = await employerUserId();
  if (!userId) return { ok: false, error: NOT_EMPLOYER };
  const id = entryIdSchema.safeParse(entryId);
  const text = z.string().max(NOTE_MAX).safeParse(note ?? "");
  if (!id.success) return { ok: false, error: NOT_FOUND };
  if (!text.success) return { ok: false, error: `Keep the note under ${NOTE_MAX.toLocaleString("en-US")} characters.` };
  const entry = await ownedEntry(id.data, userId);
  if (!entry) return { ok: false, error: NOT_FOUND };
  const value = text.data.trim() ? text.data.trim() : null;
  await db.update(shortlistEntries).set({ note: value }).where(eq(shortlistEntries.id, entry.id));
  revalidatePath(PIPELINE_PATH);
  return { ok: true, note: value };
}

/** What a removed entry looked like, so the "Undo" in the toast can put it back. */
export type RemovedCandidate = { shortlistId: number; personId: string; stage: PipelineStage; note: string | null; position: number };

/** Removes a candidate from the search. Returns the entry so it can be restored. */
export async function removeFromPipeline(entryId: number): Promise<ActionResult<{ removed: RemovedCandidate }>> {
  const userId = await employerUserId();
  if (!userId) return { ok: false, error: NOT_EMPLOYER };
  const id = entryIdSchema.safeParse(entryId);
  if (!id.success) return { ok: false, error: NOT_FOUND };
  const entry = await ownedEntry(id.data, userId);
  if (!entry) return { ok: false, error: NOT_FOUND };
  await db.delete(shortlistEntries).where(eq(shortlistEntries.id, entry.id));
  revalidatePath(PIPELINE_PATH);
  return { ok: true, removed: { shortlistId: entry.shortlistId, personId: entry.personId, stage: entry.stage, note: entry.note, position: entry.position } };
}

/** Undo for removeFromPipeline: puts the candidate back where they were, with their note. */
export async function restoreCandidate(removed: RemovedCandidate): Promise<ActionResult<{ entryId: number }>> {
  const userId = await employerUserId();
  if (!userId) return { ok: false, error: NOT_EMPLOYER };
  const parsed = z
    .object({
      shortlistId: entryIdSchema,
      personId: personIdSchema,
      stage: stageSchema,
      note: z.string().max(NOTE_MAX).nullable(),
      position: z.number().int().min(0),
    })
    .safeParse(removed);
  if (!parsed.success) return { ok: false, error: "That candidate could not be restored." };
  const r = parsed.data;
  const list = await ownedShortlist(r.shortlistId, userId);
  if (!list) return { ok: false, error: "That hiring search could not be found." };
  const [existing] = await db
    .select({ id: shortlistEntries.id })
    .from(shortlistEntries)
    .where(and(eq(shortlistEntries.shortlistId, list.id), eq(shortlistEntries.personId, r.personId)))
    .limit(1);
  if (existing) return { ok: true, entryId: existing.id };
  const [entry] = await db
    .insert(shortlistEntries)
    .values({ shortlistId: list.id, personId: r.personId, stage: r.stage, note: r.note, position: r.position })
    .returning({ id: shortlistEntries.id });
  revalidatePath(PIPELINE_PATH);
  return { ok: true, entryId: entry.id };
}
