import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Jobs" };

/** Placeholder: the jobs feature replaces this page. */
export default function JobsPage() {
  return <PlaceholderPage title="Jobs" icon={Briefcase} message="Jobs are on their way." description="Openings at Division III programs will be listed here." />;
}
