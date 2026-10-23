import { ProgramHeaderSkeleton, ProgramListSkeleton, ProgramRailSkeleton } from "@/components/program/ProgramSkeleton";
import { TwoColumnLayout } from "@/components/shell/Layouts";

/** Program page skeleton (§8.0): header card, one staff card and one rail card, matching the final layout. */
export default function ProgramLoading() {
  return (
    <TwoColumnLayout railLabel="Loading" rail={<ProgramRailSkeleton />}>
      <ProgramHeaderSkeleton />
      <ProgramListSkeleton />
    </TwoColumnLayout>
  );
}
