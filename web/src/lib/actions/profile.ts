"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { connections } from "@/db/schema";
import { getConnectionState, getPersonForAction } from "@/lib/queries/profile";
import { getSession } from "@/lib/session";

/*
 * Profile actions (/in/[slug]). Every action checks the demo session (ARCHITECTURE.md "Mutations").
 * Invites and error reports are demo stubs: they validate and confirm, and record nothing.
 */

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const personId = z.string().min(1).max(200);

/**
 * Connect on a claimed profile: creates a pending row in `connections` for the coach demo session.
 * Unclaimed profiles can't receive requests (the UI offers "Invite to claim" instead).
 */
export async function requestConnection(targetId: string): Promise<ActionResult<{ status: "pending" | "accepted" }>> {
  const parsed = personId.safeParse(targetId);
  if (!parsed.success) return { ok: false, error: "That profile couldn't be found." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in to connect." };
  if (session.user.kind !== "coach" || !session.person) return { ok: false, error: "Connections are between coach accounts. Send a message instead." };
  const target = await getPersonForAction(parsed.data);
  if (!target) return { ok: false, error: "That profile couldn't be found." };
  if (target.id === session.person.id) return { ok: false, error: "You can't connect with yourself." };
  if (!target.claimed) return { ok: false, error: `${target.firstName || target.fullName} hasn't claimed this profile yet.` };
  const existing = await getConnectionState(session.person.id, target.id);
  if (existing !== "none") return { ok: true, status: existing };
  await db.insert(connections).values({ requesterId: session.person.id, addresseeId: target.id, status: "pending" }).onConflictDoNothing();
  revalidatePath(`/in/${target.slug}`);
  return { ok: true, status: "pending" };
}

const inviteInput = z.object({ personId, note: z.string().max(1000).optional() });

/**
 * "Invite {first} to claim": demo only. Confirms for a signed-in viewer and records nothing,
 * internally or externally (no email is sent).
 */
export async function inviteToClaim(input: { personId: string; note?: string }): Promise<ActionResult<{ firstName: string }>> {
  const parsed = inviteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Keep the note under 1,000 characters." };
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in to send an invite." };
  const target = await getPersonForAction(parsed.data.personId);
  if (!target) return { ok: false, error: "That profile couldn't be found." };
  const firstName = target.firstName || target.fullName.split(" ")[0];
  if (target.claimed) return { ok: false, error: `${firstName} has already claimed this profile.` };
  if (session.person?.id === target.id) return { ok: false, error: "This is your own profile. Claim it instead." };
  return { ok: true, firstName };
}

const reportInput = z.object({ personId, message: z.string().trim().min(3).max(2000) });

/** "Report an error": demo only. Validates and confirms; nothing is recorded. Visitors may report too. */
export async function reportProfileError(input: { personId: string; message: string }): Promise<ActionResult> {
  const parsed = reportInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tell us what's wrong in a few words (up to 2,000 characters)." };
  await getSession();
  const target = await getPersonForAction(parsed.data.personId);
  if (!target) return { ok: false, error: "That profile couldn't be found." };
  return { ok: true };
}
