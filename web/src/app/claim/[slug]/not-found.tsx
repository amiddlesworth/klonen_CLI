import { UserRoundX } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** Unknown slug on /claim/[slug]. */
export default function ClaimNotFound() {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Claim your profile" />
        <EmptyState
          icon={UserRoundX}
          title="There's no profile at this address."
          description="Search for your name to find your profile, then choose Claim profile on it."
          action={<ButtonLink href="/search">Search coaches</ButtonLink>}
          spacing="lg"
        />
      </Card>
    </SingleColumnLayout>
  );
}
