import type { Metadata } from "next";
import { ForEmployers } from "@/components/landing/ForEmployers";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFrame } from "@/components/landing/LandingFrame";
import { LandingHero } from "@/components/landing/LandingHero";
import { ProofPoints } from "@/components/landing/ProofPoints";
import { SampleProfiles } from "@/components/landing/SampleProfiles";
import { fmtCount as fmt, LANDING_SUB } from "@/components/landing/copy";
import { BRAND } from "@/lib/brand";
import { getLandingStatsCached, getSampleProfiles, getTreeSearchExample } from "@/lib/queries/landing";
import { getDemoAccounts } from "@/lib/queries/shell";

export async function generateMetadata(): Promise<Metadata> {
  const stats = await getLandingStatsCached().catch(() => null);
  const title = `${BRAND.name} · ${BRAND.tagline}`;
  const description =
    stats && stats.coaches > 0
      ? `Sourced staff records and coaching trees for ${fmt(stats.coaches)} coaches and staff at ${fmt(stats.programs)} NCAA Division III football programs${stats.multiProgram > 0 ? `, ${fmt(stats.multiProgram)} of them with stops at two or more programs` : ""}, built from public athletics staff pages. Coaches can claim and correct their profiles; programs can post jobs and search by coaching tree.`
      : LANDING_SUB;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "website", siteName: BRAND.name },
  };
}

/**
 * Signed-out landing (DESIGN.md §8.10). Signed-in viewers are sent to their feed by the layout.
 * Rendered whole on the server, with no route-level loading boundary: the queries are small, and a
 * streamed boundary would leave visitors without JavaScript on the skeleton. Each data section
 * fails on its own: a failed query shows that section's inline error while the hero and search
 * keep working.
 */
export default async function LandingPage() {
  const [stats, profiles, example, accounts] = await Promise.all([
    getLandingStatsCached().catch(() => null),
    getSampleProfiles(3).catch(() => null),
    getTreeSearchExample().catch(() => null),
    getDemoAccounts().catch(() => []),
  ]);
  const account = (role: "coach" | "employer") => {
    const a = accounts.find((x) => x.role === role);
    return a ? { name: a.name, org: a.org } : null;
  };

  return (
    <LandingFrame>
      <LandingHero demoAccount={account("coach")} />
      <ProofPoints stats={stats} />
      <SampleProfiles profiles={profiles} />
      <HowItWorks onlySampleJobs={stats ? stats.realOpenJobs === 0 : false} />
      <ForEmployers
        example={example}
        depth={stats && stats.coaches > 0 ? { coaches: stats.coaches, multiProgram: stats.multiProgram } : null}
        demoAccount={account("employer")}
      />
    </LandingFrame>
  );
}
