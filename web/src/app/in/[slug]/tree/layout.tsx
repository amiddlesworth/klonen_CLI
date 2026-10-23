import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { treeCoachExists } from "@/lib/queries/tree";

/**
 * Checks the coach exists before the page streams: this layout renders outside loading.tsx's Suspense
 * boundary, so an unknown slug gets a real 404 status (not a 200 with the not-found UI).
 */
export default async function TreeLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await treeCoachExists(slug))) notFound();
  return children;
}
