"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { claims, people } from "@/db/schema";
import { getSession } from "@/lib/session";

/** `recorded` is false for a walk-through (signed out, or someone else's profile): nothing is written. */
export type ClaimResult = { ok: true; recorded: boolean } | { ok: false; error: string };

const ClaimInput = z.object({
  slug: z.string().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  /** Every stint must have been reviewed; counts only (the claims table keeps no notes). */
  confirmed: z.number().int().min(0).max(10_000),
  flagged: z.number().int().min(0).max(10_000),
});

/**
 * Records a demo claim. Demo boundary:
 * - Only the coach demo session claiming its own profile writes, and only one row per (person,
 *   user): a repeat publish updates that row's email instead of adding another. Signed-out visitors,
 *   and the coach demo on someone else's profile, can walk through the flow, but nothing is stored
 *   for them (in the live product you can claim only your own profile); athletic director accounts
 *   are refused.
 * - The row keeps status "started" (the schema default). The email code step is a stub that accepts
 *   any six digits, so nothing here was verified, and the row never says it was.
 * - It never touches `people` or `tenures`, so the public profile stays exactly as the public
 *   sources built it (we never mark a real person as having claimed a profile).
 */
export async function submitClaim(input: z.input<typeof ClaimInput>): Promise<ClaimResult> {
  const parsed = ClaimInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check your school email and try again." };

  const session = await getSession();
  if (session?.user.kind === "employer") {
    return { ok: false, error: "Athletic director accounts can't claim a coach's profile. Switch to the coach demo or sign out." };
  }

  const [person] = await db.select({ id: people.id, claimed: people.claimed }).from(people).where(eq(people.slug, parsed.data.slug)).limit(1);
  if (!person) return { ok: false, error: "We couldn't find this profile any more." };
  if (person.claimed) return { ok: false, error: "This profile has already been claimed." };
  if (!session || session.person?.slug !== parsed.data.slug) return { ok: true, recorded: false };

  try {
    // One row per (person, user), enforced by claims_person_user_idx, so concurrent publishes can't
    // add a second row: a repeat updates the email.
    await db
      .insert(claims)
      .values({ personId: person.id, userId: session.user.id, email: parsed.data.email, status: "started" })
      .onConflictDoUpdate({ target: [claims.personId, claims.userId], set: { email: parsed.data.email, status: "started" } });
    return { ok: true, recorded: true };
  } catch {
    return { ok: false, error: "We couldn't record your claim. Try again." };
  }
}
