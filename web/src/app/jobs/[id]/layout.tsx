import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getJobDetail } from "@/lib/queries/jobsx";

function parseId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

/**
 * Looks the job up above the page's loading boundary, so a missing or malformed id answers with a
 * real 404 before the streamed skeleton is sent (as programs/[slug]/layout.tsx does). The lookup is
 * cached per request, so the page's own read costs nothing. app/jobs/not-found.tsx renders the
 * message, and a database failure here falls to app/jobs/error.tsx.
 */
export default async function JobLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id || !(await getJobDetail(id))) notFound();
  return children;
}
