"use client";
import { useEffect } from "react";
import { PageContainer } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Inline error for the pipeline (§8.0 Error): one sentence and "Try again". */
export default function PipelineError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageContainer>
      <Card padding="main" aria-labelledby="pipeline-title">
        <CardHeader as="h1" id="pipeline-title" title="Hiring pipeline" />
        <ErrorState
          message="The hiring pipeline didn't load."
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
