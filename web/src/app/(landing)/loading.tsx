import { LandingFrame } from "@/components/landing/LandingFrame";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingSectionsSkeleton } from "@/components/landing/LandingSkeleton";

/** The hero needs no data, so it renders for real (search works at once); the data sections are skeletons. */
export default function LandingLoading() {
  return (
    <LandingFrame>
      <LandingHero />
      <LandingSectionsSkeleton />
    </LandingFrame>
  );
}
