"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { claims, people } from "@/db/schema";
import { getSession } from "@/lib/session";

export type ClaimResult = { ok: true; claimId: number } | { ok: false; error: string };

const ClaimInput = z.object({
  slug: z.string().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(254),
  /** Every stint must have been reviewed; counts only (the claims table keeps no notes). */
  confirmed: z.number().int().min(0),
  flagged: z.number().int().min(0),
});

/**
 * Records a verified claim. Demo boundary: this inserts one row into `claims` (status "verified")
 * and nothing else. It never touches `people` or `tenures`, so the public profile stays exactly as
 * the public sources built it. In the live product this is where the profile would be published.
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

  try {
    const [row] = await db
      .insert(claims)
      .values({ personId: person.id, userId: session?.user.id ?? null, email: parsed.data.email, status: "verified" })
      .returning({ id: claims.id });
    return { ok: true, claimId: row.id };
  } catch {
    return { ok: false, error: "We couldn't record your claim. Try again." };
  }
}
