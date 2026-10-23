import type { Metadata } from "next";
import { UserX } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Coach not found", robots: { index: false } };

/**
 * An unknown slug is answered by app/in/[slug]/not-found.tsx (the route layout 404s before this segment
 * renders). This one is still reached when the coach disappears between the layout's check and the page's
 * query, so it says exactly what the profile's not-found page says.
 */
export default function TreeNotFound() {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Coach not found" />
        <EmptyState
          icon={UserX}
          title="There's no coach profile at this address."
          description="The link may be mistyped, or the profile may have moved. Search by name, program or conference."
          action={<ButtonLink href="/search?type=people">Search coaches</ButtonLink>}
          spacing="lg"
        />
      </Card>
    </SingleColumnLayout>
  );
}
