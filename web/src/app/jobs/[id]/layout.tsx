import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJobDetail } from "@/lib/queries/jobsx";

function parseId(raw: string): number | null {
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

type LayoutProps = { children: ReactNode; params: Promise<{ id: string }> };

/**
 * The 404's title. The layout calls notFound() before the page's generateMetadata can run, so the
 * layout names the missing job itself (a found job's page metadata overrides this). Cached lookup.
 */
export async function generateMetadata({ params }: Omit<LayoutProps, "children">): Promise<Metadata> {
  const id = parseId((await params).id);
  if (!id || !(await getJobDetail(id))) return { title: "Job not found", robots: { index: false } };
  return {};
}

/**
 * Looks the job up above the page's loading boundary, so a missing or malformed id answers with a
 * real 404 before the streamed skeleton is sent (as programs/[slug]/layout.tsx does). The lookup is
 * cached per request, so the page's own read costs nothing. app/jobs/not-found.tsx renders the
 * message, and a database failure here falls to app/jobs/error.tsx.
 */
export default async function JobLayout({ children, params }: LayoutProps) {
  const id = parseId((await params).id);
  if (!id || !(await getJobDetail(id))) notFound();
  return children;
}
