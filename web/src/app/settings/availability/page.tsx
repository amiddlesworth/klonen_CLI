import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export const metadata: Metadata = { title: "Open to opportunities" };

/** Placeholder: the claim feature replaces this page. */
export default function AvailabilityPage() {
  return (
    <PlaceholderPage
      layout="single"
      title="Open to opportunities"
      icon={Lock}
      message="This setting is on its way."
      description="Choose who can see that you are open to new roles. It is never shown on your public profile."
    />
  );
}
