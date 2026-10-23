import type { Metadata } from "next";
import { ForEmployers } from "@/components/landing/ForEmployers";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFrame } from "@/components/landing/LandingFrame";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProofPoints } from "@/components/landing/ProofPoints";
import { SampleProfiles } from "@/components/landing/SampleProfiles";
import { BRAND } from "@/lib/brand";
import { getLandingStatsCached, getSampleProfiles, getTreeSearchExample } from "@/lib/queries/landing";
import { getDemoAccounts } from "@/lib/queries/shell";

const fmt = (n: number) => n.toLocaleString("en-US");

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getLandingStatsCached().catch(() => null);
  const title = `${BRAND.name} · ${BRAND.tagline}`;
  const description =
    stats && stats.coaches > 0
      ? `Career records and coaching trees for ${fmt(stats.coaches)} coaches at ${fmt(stats.programs)} NCAA Division III football programs, built from public athletics staff pages. Coaches claim and correct their profiles; programs post jobs and search by coaching tree.`
      : BRAND.description;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "website", siteName: BRAND.name },
  };
}

/**
 * Signed-out landing (DESIGN.md §8.10). Signed-in viewers are sent to their feed by the layout.
 * Each data section fails on its own: a failed query shows that section's inline error while the
 * hero and search keep working.
 */
export default async function LandingPage() {
  const [stats, profiles, example, accounts] = await Promise.all([
    getLandingStatsCached().catch(() => null),
    getSampleProfiles(4).catch(() => null),
    getTreeSearchExample().catch(() => null),
    getDemoAccounts().catch(() => []),
  ]);
  const coach = accounts.find((a) => a.role === "coach");

  return (
    <LandingFrame>
      <LandingHero demoAccount={coach ? { name: coach.name, org: coach.org } : null} />
      <ProofPoints stats={stats} />
      <SampleProfiles profiles={profiles} />
      <HowItWorks />
      <ForEmployers example={example} />
    </LandingFrame>
  );
}
