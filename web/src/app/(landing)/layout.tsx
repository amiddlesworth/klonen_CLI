import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * Signed-in viewers (a demo session) go to their feed. Checked here, above the page's loading
 * boundary, so they get a real redirect before the landing skeleton streams.
 */
export default async function LandingLayout({ children }: { children: ReactNode }) {
  if (await getSession().catch(() => null)) redirect("/feed");
  return children;
}
