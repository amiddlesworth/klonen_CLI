"use client";
import { useEffect } from "react";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Inline error (§8.0) inside the card that would hold the program: one sentence and "Try again". */
export default function ProgramError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <TwoColumnLayout railLabel="Related">
      <Card padding="main" aria-labelledby="program-error-title">
        <CardHeader as="h1" id="program-error-title" title="Program" />
        <ErrorState
          message="This program page didn't load. The connection may have dropped."
          action={
            <Button variant="ghost" size="sm" onClick={reset}>
              Try again
            </Button>
          }
        />
      </Card>
    </TwoColumnLayout>
  );
}
