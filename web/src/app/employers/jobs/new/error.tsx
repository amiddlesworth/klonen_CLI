"use client";
import { useEffect } from "react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Post a job: an inline error inside the card (§8.0 Error), under the page's usual h1. */
export default function PostJobError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <SingleColumnLayout>
      <Card padding="main" aria-labelledby="post-job-error-title">
        <h1 id="post-job-error-title" className="mb-3 text-display-sm">
          Post a job
        </h1>
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
