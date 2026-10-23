import { BreadcrumbSkeleton, ProfileMainSkeleton, ProfileRailSkeleton } from "@/components/profile/ProfileSkeleton";
import { TwoColumnLayout } from "@/components/shell/Layouts";

/** Profile skeleton (§8.0, §8.4): real card chrome, static blocks, the same grid as the page. */
export default function ProfileLoading() {
  return (
    <TwoColumnLayout breadcrumb={<BreadcrumbSkeleton />} railLabel="Program and related people" rail={<ProfileRailSkeleton />}>
      <ProfileMainSkeleton />
    </TwoColumnLayout>
  );
}
