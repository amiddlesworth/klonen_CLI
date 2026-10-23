"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, type DemoRole } from "@/lib/session";

export async function switchDemoAccount(role: DemoRole | "signed_out", redirectTo = "/feed") {
  const jar = await cookies();
  if (role === "signed_out") {
    jar.delete(SESSION_COOKIE);
    redirect("/");
  }
  jar.set(SESSION_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(redirectTo);
}
