import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { resolveProgramSlug } from "@/components/program/resolve";

/**
 * Resolves the slug above the page's loading boundary, so an unknown slug answers with a real 404
 * before the streamed skeleton is sent. A database failure here is caught by app/programs/error.tsx
 * (a segment's own error boundary sits inside its layout). The uppercase-slug redirect happens in
 * the page, which can see the query string and keep it.
 */
export default async function ProgramLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await resolveProgramSlug(slug))) notFound();
  return children;
}
