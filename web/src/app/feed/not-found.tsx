import { Repeat } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** A feed page past the end (?page= beyond the last page). */
export default function FeedNotFound() {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Home feed" />
        <EmptyState
          icon={Repeat}
          title="This page of your feed doesn't exist."
          description="The feed may have fewer pages now. Start again from the top."
          action={<ButtonLink href="/feed">Back to your feed</ButtonLink>}
          spacing="lg"
        />
      </Card>
    </SingleColumnLayout>
  );
}
