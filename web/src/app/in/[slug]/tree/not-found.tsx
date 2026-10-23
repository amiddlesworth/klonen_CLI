import { UserX } from "lucide-react";
import { PageContainer } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** No coach at this address (DESIGN.md §8.0 empty state inside a card). */
export default function TreeNotFound() {
  return (
    <PageContainer>
      <Card padding="main">
        <CardHeader as="h1" title="Coach not found" />
        <EmptyState
          icon={UserX}
          title="There's no coach profile at this address."
          description="The link may be mistyped, or the profile may have moved. Search for a coach or a program instead."
          action={<ButtonLink href="/search">Go to search</ButtonLink>}
          spacing="lg"
        />
      </Card>
    </PageContainer>
  );
}
