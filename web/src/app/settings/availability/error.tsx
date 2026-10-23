"use client";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** The setting couldn't load: inline error with Try again. */
export default function AvailabilityError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Open to opportunities" />
        <ErrorState
          message="We couldn't load your Open to opportunities setting."
          action={
            <Button variant="ghost" size="sm" onClick={reset}>
              Try again
            </Button>
          }
        />
      </Card>
    </SingleColumnLayout>
  );
}
