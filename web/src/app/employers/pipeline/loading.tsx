import { PipelineSkeleton } from "@/components/employer/PipelineSkeleton";
import { PageContainer } from "@/components/shell/Layouts";

export default function PipelineLoading() {
  return (
    <PageContainer>
      <PipelineSkeleton />
    </PageContainer>
  );
}
