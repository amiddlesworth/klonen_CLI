import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/**
 * The feed is for signed-in viewers; visitors go to the landing page. Checked here, above the
 * loading boundary, so a visitor gets a real redirect instead of a streamed skeleton.
 */
export default async function FeedLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");
  return children;
}
