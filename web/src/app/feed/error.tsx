"use client";
import { RotateCw } from "lucide-react";
import { PageContainer } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Error state for /feed (§8.0): inline in a card, one sentence and "Try again". */
export default function FeedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer className="max-w-[640px] md:box-content">
      <h1 className="sr-only">Home feed</h1>
      <Card padding="main">
        <ErrorState
          message="We couldn't load your feed."
          action={
            <Button variant="ghost" size="sm" icon={RotateCw} onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </Card>
    </PageContainer>
  );
}
