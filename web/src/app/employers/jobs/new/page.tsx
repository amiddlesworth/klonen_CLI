import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Post a job" };

/** Placeholder: the jobs feature replaces this page. */
export default function PostJobPage() {
  return (
    <PlaceholderPage
      layout="single"
      title="Post a job"
      icon={Briefcase}
      message="Job posting is on its way."
      description="Athletic directors will post openings here, with a preview of the listing."
    />
  );
}
