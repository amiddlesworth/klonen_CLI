"use server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { claims, people } from "@/db/schema";
import { getSession } from "@/lib/session";

/** `recorded` is false for signed-out visitors: their walk-through ends without writing anything. */
export type ClaimResult = { ok: true; recorded: boolean } | { ok: false; error: string };

const ClaimInput = z.object({
  slug: z.string().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  /** Every stint must have been reviewed; counts only (the claims table keeps no notes). */
  confirmed: z.number().int().min(0),
  flagged: z.number().int().min(0),
});

/**
 * Records a demo claim. Demo boundary:
 * - Only the coach demo session writes, and only one row per (person, user): a repeat publish
 *   updates that row's email instead of adding another. Signed-out visitors can walk through the
 *   flow, but nothing is stored for them; athletic director accounts are refused.
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
  if (!session) return { ok: true, recorded: false };

  try {
    const userId = session.user.id;
    const [existing] = await db
      .select({ id: claims.id })
      .from(claims)
      .where(and(eq(claims.personId, person.id), eq(claims.userId, userId)))
      .orderBy(desc(claims.id))
      .limit(1);
    if (existing) {
      await db.update(claims).set({ email: parsed.data.email, status: "started" }).where(eq(claims.id, existing.id));
    } else {
      await db.insert(claims).values({ personId: person.id, userId, email: parsed.data.email, status: "started" });
    }
    return { ok: true, recorded: true };
  } catch {
    return { ok: false, error: "We couldn't record your claim. Try again." };
  }
}
