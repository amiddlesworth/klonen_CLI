"use server";
import { cookies } from "next/headers";
import { FOLLOW_COOKIE, FOLLOW_LIMIT, getRegistryProgramById, parseFollowCookie } from "@/lib/queries/program";
import { getSession } from "@/lib/session";

export type FollowResult = { ok: true; following: boolean } | { ok: false; reason: "signed_out" | "not_found" };

/**
 * Follow or unfollow a registry program for the signed-in demo account. Demo follows are stored in a
 * cookie (there is no follows table yet); signed-out visitors are asked to pick a demo account.
 */
export async function setProgramFollow(orgId: string, follow: boolean): Promise<FollowResult> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  if (typeof orgId !== "string" || !(await getRegistryProgramById(orgId))) return { ok: false, reason: "not_found" };

  const jar = await cookies();
  const current = parseFollowCookie(jar.get(FOLLOW_COOKIE)?.value).filter((id) => id !== orgId);
  const next = follow ? [orgId, ...current].slice(0, FOLLOW_LIMIT) : current;
  jar.set(FOLLOW_COOKIE, JSON.stringify(next), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true, following: follow };
}
