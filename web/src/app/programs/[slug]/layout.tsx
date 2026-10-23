import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { resolveProgramSlug } from "@/components/program/resolve";

/**
 * Resolves the slug above the page's loading boundary, so an unknown slug answers with a real 404
 * (and an uppercase slug with a 308) before the streamed skeleton is sent.
 */
export default async function ProgramLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await resolveProgramSlug(slug))) notFound();
  return children;
}
