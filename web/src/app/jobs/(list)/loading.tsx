import { PageContainer } from "@/components/shell/Layouts";
import { JobsHeaderSkeleton, JobsListSkeleton } from "@/components/jobs/skeletons";

export default function JobsLoading() {
  return (
    <PageContainer>
      <JobsHeaderSkeleton />
      <JobsListSkeleton />
    </PageContainer>
  );
}
