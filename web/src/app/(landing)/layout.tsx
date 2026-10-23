import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Signed-in viewers (a demo session) go to their feed. Checked here, before the page's queries
 * run, so they get a real redirect.
 */
export default async function LandingLayout({ children }: { children: ReactNode }) {
  if (await getSession().catch(() => null)) redirect("/feed");
  return children;
}
