"use server";
import { cookies } from "next/headers";
import { FOLLOW_COOKIE, FOLLOW_LIMIT, FOLLOW_USERS_LIMIT, getRegistryProgramById, parseFollowCookie } from "@/lib/queries/program";
import { getSession } from "@/lib/session";

export type FollowResult = { ok: true; following: boolean } | { ok: false; reason: "signed_out" | "not_found" };

/**
 * Follow or unfollow a registry program for the signed-in demo account. Demo follows are stored in a
 * cookie keyed by the demo user (there is no follows table yet), so each demo account keeps its own
 * list; signed-out visitors are asked to pick a demo account.
 */
export async function setProgramFollow(orgId: string, follow: boolean): Promise<FollowResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  if (typeof orgId !== "string" || !(await getRegistryProgramById(orgId))) return { ok: false, reason: "not_found" };

  const jar = await cookies();
  const all = parseFollowCookie(jar.get(FOLLOW_COOKIE)?.value);
  const userId = session.user.id;
  const current = (all[userId] ?? []).filter((id) => id !== orgId);
  const mine = follow ? [orgId, ...current].slice(0, FOLLOW_LIMIT) : current;
  // This user first, then up to FOLLOW_USERS_LIMIT - 1 other demo accounts.
  const others = Object.entries(all).filter(([u]) => u !== userId).slice(0, FOLLOW_USERS_LIMIT - 1);
  const next = Object.fromEntries([[userId, mine], ...others]);
  jar.set(FOLLOW_COOKIE, JSON.stringify(next), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true, following: follow };
}
