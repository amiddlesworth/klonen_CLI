import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { treeCoachExists } from "@/lib/queries/tree";

type Params = Promise<{ slug: string }>;

/** An unknown slug's 404 says so in the document title too (the page's own metadata never runs for it). */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  return (await treeCoachExists(slug)) ? {} : { title: "Coach not found", robots: { index: false } };
}

/**
 * Checks the coach exists before the page streams: this layout renders outside loading.tsx's Suspense
 * boundary, so an unknown slug gets a real 404 status (not a 200 with the not-found UI), rendered by
 * app/in/[slug]/not-found.tsx like an unknown profile.
 */
export default async function TreeLayout({ children, params }: { children: ReactNode; params: Params }) {
  const { slug } = await params;
  if (!(await treeCoachExists(slug))) notFound();
  return children;
}
