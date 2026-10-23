"use client";
import { useEffect } from "react";
import { SidebarLayout } from "@/components/shell/Layouts";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";

/** Search failed to load (§8.0 Error): inline in the results card, with "Try again". */
export default function SearchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <SidebarLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Search" />
        <ErrorState
          message="Search results couldn't load right now."
          action={
            <Button variant="ghost" size="sm" onClick={reset}>
              Try again
            </Button>
          }
        />
      </Card>
    </SidebarLayout>
  );
}
