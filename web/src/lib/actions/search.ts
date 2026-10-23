"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { connections, people } from "@/db/schema";
import { getSession } from "@/lib/session";

export type ConnectResult = { ok: true } | { ok: false; reason: "signed_out" | "not_coach" | "unclaimed" | "self" | "not_found" };

const PersonId = z.string().min(1).max(200);

/**
 * Connect from a search result: a pending connection request from the demo coach to a claimed
 * profile. Unclaimed profiles cannot receive requests (the row offers "Invite to claim" instead).
 */
export async function requestConnection(rawPersonId: string): Promise<ConnectResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  if (session.user.kind !== "coach" || !session.person) return { ok: false, reason: "not_coach" };
  const parsed = PersonId.safeParse(rawPersonId);
  if (!parsed.success) return { ok: false, reason: "not_found" };
  const personId = parsed.data;
  if (session.person.id === personId) return { ok: false, reason: "self" };
  const [target] = await db.select({ id: people.id, claimed: people.claimed }).from(people).where(eq(people.id, personId)).limit(1);
  if (!target) return { ok: false, reason: "not_found" };
  if (!target.claimed) return { ok: false, reason: "unclaimed" };
  const [existing] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.requesterId, session.person.id), eq(connections.addresseeId, personId)))
    .limit(1);
  if (!existing) await db.insert(connections).values({ requesterId: session.person.id, addresseeId: personId, status: "pending" }).onConflictDoNothing();
  return { ok: true };
}
