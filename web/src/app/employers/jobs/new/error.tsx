"use client";
import { useEffect } from "react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Post a job: an inline error inside the card (§8.0 Error). */
export default function PostJobError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Post a job" />
        <ErrorState
          message="The job form couldn't load right now. Nothing was published."
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
