"use client";
import { PageContainer } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Tree explorer error (DESIGN.md §8.0): inline in the card, one sentence and "Try again". */
export default function TreeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer>
      <Card padding="main">
        <CardHeader as="h1" title="Coaching tree" />
        <ErrorState
          message="We couldn't load this coaching tree."
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
