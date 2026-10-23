"use client";
import { RotateCw } from "lucide-react";
import { PageContainer } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Messaging couldn't load (§8.0): inline error in the card with Try again. */
export default function MessagingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageContainer className="max-w-[640px] md:box-content">
      <Card padding="main">
        <CardHeader as="h1" title="Messaging" />
        <ErrorState
          message="We couldn't load your messages."
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
