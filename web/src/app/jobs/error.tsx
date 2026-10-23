"use client";
import { useEffect } from "react";
import { PageContainer } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Jobs routes: an inline error inside the card that would hold the content (§8.0 Error), under the page's usual h1. */
export default function JobsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageContainer>
      <Card padding="main" aria-labelledby="jobs-error-title">
        <h1 id="jobs-error-title" className="mb-3 text-display-sm">
          Jobs
        </h1>
        <ErrorState
          message="Jobs couldn't load right now."
          action={
            <Button variant="ghost" size="sm" onClick={reset}>
              Try again
            </Button>
          }
        />
      </Card>
    </PageContainer>
  );
}
