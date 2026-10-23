import { MessageSquareOff } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** ?thread= names a conversation that doesn't exist or belongs to another account. */
export default function MessagingNotFound() {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Messaging" />
        <EmptyState
          icon={MessageSquareOff}
          title="This conversation isn't available."
          description="It may belong to another demo account, or the link is incomplete."
          action={<ButtonLink href="/messaging">Back to Messaging</ButtonLink>}
          spacing="lg"
        />
      </Card>
    </SingleColumnLayout>
  );
}
