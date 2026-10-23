"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { FOLLOW_COOKIE, FOLLOW_LIMIT, FOLLOW_USERS_LIMIT, JOB_ALERT_COOKIE, getRegistryProgramById, parseFollowCookie } from "@/lib/queries/program";
import { cookieOptions, getSession } from "@/lib/session";

export type FollowResult = { ok: true; following: boolean } | { ok: false; reason: "signed_out" | "not_found" };
export type JobAlertResult = { ok: true; on: boolean } | { ok: false; reason: "signed_out" | "not_found" };

/** Arguments are client input: a program id string and a real boolean, nothing else. */
const FlagInput = z.object({ orgId: z.string().min(1).max(64), on: z.boolean() });

/**
 * Adds or removes a registry program in one per-demo-user cookie list (follows, job alerts): this user
 * first, then up to FOLLOW_USERS_LIMIT - 1 other demo accounts, each capped at FOLLOW_LIMIT ids.
 */

async function setProgramFlag(cookieName: string, rawOrgId: string, rawOn: boolean): Promise<{ ok: true; on: boolean } | { ok: false; reason: "signed_out" | "not_found" }> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed_out" };
  const parsed = FlagInput.safeParse({ orgId: rawOrgId, on: rawOn });
  if (!parsed.success) return { ok: false, reason: "not_found" };
  const { orgId, on } = parsed.data;
  if (!(await getRegistryProgramById(orgId))) return { ok: false, reason: "not_found" };

  const jar = await cookies();
  const all = parseFollowCookie(jar.get(cookieName)?.value);
  const userId = session.user.id;
  const current = (all[userId] ?? []).filter((id) => id !== orgId);
  const mine = on ? [orgId, ...current].slice(0, FOLLOW_LIMIT) : current;
  const others = Object.entries(all).filter(([u]) => u !== userId).slice(0, FOLLOW_USERS_LIMIT - 1);
  const next = Object.fromEntries([[userId, mine], ...others]);
  jar.set(cookieName, JSON.stringify(next), cookieOptions(60 * 60 * 24 * 365));
  return { ok: true, on };
}

/**
 * Follow or unfollow a registry program for the signed-in demo account. Demo follows are stored in a
 * cookie keyed by the demo user (there is no follows table yet), so each demo account keeps its own
 * list; signed-out visitors are asked to pick a demo account.
 */
export async function setProgramFollow(orgId: string, follow: boolean): Promise<FollowResult> {
  const res = await setProgramFlag(FOLLOW_COOKIE, orgId, follow);
  return res.ok ? { ok: true, following: res.on } : res;
}

/** Turn a demo job alert for a program on or off (the empty Jobs tab's "Set a job alert"), stored like follows. */
export async function setProgramJobAlert(orgId: string, on: boolean): Promise<JobAlertResult> {
  const res = await setProgramFlag(JOB_ALERT_COOKIE, orgId, on);
  return res.ok ? { ok: true, on: res.on } : res;
}
