"use client";
import { useEffect } from "react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** The profile failed to load (§8.0 Error): inline message and "Try again". */
export default function ProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Coach profile" />
        <ErrorState
          message="This profile couldn't load right now."
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
