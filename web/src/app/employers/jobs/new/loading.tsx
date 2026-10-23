import { PageContainer } from "@/components/shell/Layouts";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PostJobSkeleton } from "@/components/jobs/skeletons";

export default function PostJobLoading() {
  return (
    <PageContainer breadcrumb={<Breadcrumb items={[{ label: "Hiring pipeline", href: "/employers/pipeline" }]} current="Post a job" phone="back" />}>
      <PostJobSkeleton />
    </PageContainer>
  );
}
