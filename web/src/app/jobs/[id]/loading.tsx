import { TwoColumnLayout } from "@/components/shell/Layouts";
import { JobPageSkeleton, RailSkeleton } from "@/components/jobs/skeletons";

export default function JobLoading() {
  return (
    <TwoColumnLayout railLabel="Program and similar jobs" rail={<RailSkeleton />}>
      <JobPageSkeleton />
    </TwoColumnLayout>
  );
}
