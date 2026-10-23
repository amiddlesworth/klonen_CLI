import { FolderSearch } from "lucide-react";
import { PipelineFrame } from "@/components/employer/PipelineFrame";
import { PageContainer } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/** A `?list=` that doesn't exist or belongs to another account (served with a 404 status). */
export default function PipelineNotFound() {
  return (
    <PageContainer>
      <PipelineFrame>
        <EmptyState
          as="h2"
          icon={FolderSearch}
          title="This hiring search doesn't exist."
          description="It may have been removed, or it belongs to another account."
          action={
            <ButtonLink href="/employers/pipeline" phone="large">
              Back to your pipeline
            </ButtonLink>
          }
          spacing="lg"
        />
      </PipelineFrame>
    </PageContainer>
  );
}
