"use client";
import { RotateCw } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Notifications couldn't load (§8.0): inline error in the card with Try again. */
export default function NotificationsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Notifications" />
        <ErrorState
          message="We couldn't load your notifications."
          action={
            <Button variant="ghost" icon={RotateCw} onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </Card>
    </SingleColumnLayout>
  );
}
