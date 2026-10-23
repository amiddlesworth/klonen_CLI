"use client";
import { useEffect } from "react";
import { PipelineFrame } from "@/components/employer/PipelineFrame";
import { PageContainer } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/EmptyState";

/** Inline error for the pipeline (§8.0 Error): one sentence and "Try again", under the page title. */
export default function PipelineError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageContainer>
      <PipelineFrame>
        <ErrorState
          className="pb-4 pt-3 md:pb-5"
          message="The hiring pipeline didn't load."
          action={
            <Button variant="ghost" size="sm" onClick={reset}>
              Try again
            </Button>
          }
        />
      </PipelineFrame>
    </PageContainer>
  );
}
