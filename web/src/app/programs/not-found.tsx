import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Program not found", robots: { index: false } };

/** Unknown program slug (the [slug] layout answers 404 before streaming). */
export default function ProgramNotFound() {
  return (
    <SingleColumnLayout>
      <Card padding="main" aria-labelledby="program-missing-title">
        <CardHeader as="h1" id="program-missing-title" title="Program not found" />
        <EmptyState
          icon={SearchX}
          title="No program or organization at this address."
          description="Search by school name, nickname or conference abbreviation."
          action={<ButtonLink href="/search?type=programs">Search programs</ButtonLink>}
          spacing="lg"
        />
      </Card>
    </SingleColumnLayout>
  );
}
