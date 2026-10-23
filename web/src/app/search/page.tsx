import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Search" };

/** Placeholder: the search feature replaces this page. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = q?.trim();
  return (
    <PlaceholderPage
      layout="sidebar"
      title={term ? `Results for ‘${term}’` : "Search"}
      icon={Search}
      message="Search results are on their way."
      description="Coaches and programs, with filters for division, conference, state and coaching tree, will show up here."
    />
  );
}
