import { UserX } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** Unknown profile slug: notFound() from the (profile) layout, above the loading boundary, so the status is a real 404. */
export default function ProfileNotFound() {
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
