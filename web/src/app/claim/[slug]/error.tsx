"use client";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** The claim flow couldn't load (e.g. the database is unreachable): inline error with Try again. */
export default function ClaimError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Claim your profile" />
        <ErrorState
          message="We couldn't load this profile's career record."
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
