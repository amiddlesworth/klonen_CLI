import { PageContainer } from "@/components/shell/Layouts";
import { PostJobSkeleton } from "@/components/jobs/skeletons";

export default function PostJobLoading() {
  return (
    <PageContainer>
      <PostJobSkeleton />
    </PageContainer>
  );
}
