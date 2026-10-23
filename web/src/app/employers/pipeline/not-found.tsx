import { FolderSearch } from "lucide-react";
import { PageContainer } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** A `?list=` that doesn't exist or belongs to another account. */
export default function PipelineNotFound() {
  return (
    <PageContainer>
      <Card padding="main" aria-labelledby="pipeline-title">
        <CardHeader as="h1" id="pipeline-title" title="Hiring pipeline" />
        <EmptyState
          as="h2"
          icon={FolderSearch}
          title="This hiring search doesn't exist."
          description="It may have been removed, or it belongs to another account."
          action={<ButtonLink href="/employers/pipeline">Back to your pipeline</ButtonLink>}
          spacing="lg"
        />
      </Card>
    </PageContainer>
  );
}
