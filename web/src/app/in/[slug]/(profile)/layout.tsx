import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfileCached } from "@/lib/queries/profile";

/**
 * Resolves the slug above the page's loading boundary, so an unknown slug answers with a real 404
 * (rendered by app/in/[slug]/not-found.tsx) before the streamed skeleton is sent. The page reads the
 * same request-cached profile, so this costs no extra query. A database failure here is caught by
 * app/in/[slug]/error.tsx (a segment's own error boundary sits inside its layout).
 */
export default async function ProfileLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getProfileCached(slug))) notFound();
  return children;
}
