import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Hiring pipeline" };

/** Placeholder: the employer feature replaces this page. */
export default function PipelinePage() {
  return (
    <PlaceholderPage
      layout="page"
      title="Hiring pipeline"
      icon={Users}
      message="No candidates here yet."
      description="Shortlisted coaches will show up here by stage: Sourced, Contacted, Interview and Offer."
    />
  );
}
