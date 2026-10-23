"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cookieOptions, DEMO_ROLES, SESSION_COOKIE, type DemoRole } from "@/lib/session";
import { safeRedirectPath } from "@/lib/site";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
/** Only the demo roles, or signing out. Anything else (e.g. "__proto__") is refused before it reaches the cookie. */
const RoleInput = z.enum([...DEMO_ROLES, "signed_out"]);

/**
 * Switches the demo account (Me menu, landing). Both arguments come from the client: the role must be
 * one of the demo roles, and `redirectTo` must be a path on this site ("/x", never "//x" or an
 * absolute URL); anything else goes to the feed.
 */
export async function switchDemoAccount(role: DemoRole | "signed_out", redirectTo: string = "/feed") {
  const parsed = RoleInput.safeParse(role);
  if (!parsed.success) redirect("/");
  const jar = await cookies();
  if (parsed.data === "signed_out") {
    jar.delete(SESSION_COOKIE);
    redirect("/");
  }
  jar.set(SESSION_COOKIE, parsed.data, cookieOptions(SESSION_MAX_AGE));
  redirect(safeRedirectPath(redirectTo, "/feed"));
}
