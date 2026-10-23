import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlumniTab } from "@/components/program/AlumniTab";
import { FollowButton } from "@/components/program/FollowButton";
import { JobsTab } from "@/components/program/JobsTab";
import { LightOrgPage } from "@/components/program/LightOrgPage";
import { ProgramHeader } from "@/components/program/ProgramHeader";
import { ProgramJsonLd } from "@/components/program/ProgramJsonLd";
import { ProgramMoreMenu } from "@/components/program/ProgramMoreMenu";
import { ConferencePeersCard, CoachesFromHereCard, HiringCard } from "@/components/program/ProgramRail";
import { ProgramListSkeleton } from "@/components/program/ProgramSkeleton";
import { resolveProgramSlug } from "@/components/program/resolve";
import { StaffTab } from "@/components/program/StaffTab";
import { SampleChip } from "@/components/ui/Chip";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import { BRAND } from "@/lib/brand";
import { levelFull } from "@/lib/format";
import {
  getConferencePeers,
  getFollowedOrgIds,
  getProgramCounts,
  getProgramPlayers,
  getProgramStaff,
  type ProgramCounts,
  type ProgramOrg,
} from "@/lib/queries/program";
import { getSession } from "@/lib/session";

type Tab = "staff" | "alumni" | "jobs";
const TABS: Tab[] = ["staff", "alumni", "jobs"];

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function parseTab(v: string | string[] | undefined): Tab {
  const t = first(v);
  return TABS.includes(t as Tab) ? (t as Tab) : "staff";
}

function parsePage(v: string | string[] | undefined): number {
  const n = Number.parseInt(first(v) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function tabHref(slug: string, tab: Tab) {
  return tab === "staff" ? `/programs/${slug}` : `/programs/${slug}?tab=${tab}`;
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function describe(org: ProgramOrg, counts: ProgramCounts): string {
  if (!org.inRegistry) {
    const level = levelFull(org.level);
    const coached = `${counts.coached} ${counts.coached === 1 ? "coach" : "coaches"} on ${BRAND.name} worked at ${org.name}${level ? ` (${level})` : ""}`;
    return `${coached} and ${counts.played} played there. See where they coach now, from public staff pages and coach bios.`;
  }
  const team = [org.name, org.nickname, "football"].filter(Boolean).join(" ");
  const league = [levelFull(org.level), org.conference].filter(Boolean).join(", ");
  const staff = counts.staff ? `${counts.staff} staff listed` : "staff page not read yet";
  return `${team}${league ? ` (${league})` : ""}: ${staff}, ${counts.coached} alumni coaches and ${counts.jobs} open ${counts.jobs === 1 ? "job" : "jobs"}. Built from public staff pages and coach bios.`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await resolveProgramSlug(slug);
  if (!org) notFound();
  const tab = org.inRegistry ? parseTab((await searchParams).tab) : "staff";
  const counts = await getProgramCounts(org.id);
  const base = org.inRegistry ? `${org.name} football` : org.name;
  const title = tab === "alumni" ? `Alumni coaches · ${base}` : tab === "jobs" ? `Jobs · ${base}` : org.inRegistry ? `${base} staff` : base;
  const description = describe(org, counts);
  const canonical = tabHref(org.slug, tab);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} · ${BRAND.name}`, description, type: "website", url: canonical, siteName: BRAND.name },
    twitter: { card: "summary", title: `${title} · ${BRAND.name}`, description },
  };
}

/**
 * Program page (DESIGN.md §8.6) for any organization slug. Registry programs (NCAA D-III football)
 * get the header card with Follow, tabs (?tab=staff|alumni|jobs) and a rail of conference peers,
 * coaches from here and a Hiring card; every other organization gets the lighter page.
 */
export default async function ProgramPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const org = await resolveProgramSlug(slug);
  if (!org) notFound();

  const origin = await siteOrigin();
  const page = parsePage(sp.page);
  const counts = await getProgramCounts(org.id);

  if (!org.inRegistry) {
    return <LightOrgPage org={org} counts={counts} page={page} url={`${origin}/programs/${org.slug}`} origin={origin} />;
  }

  const tab = parseTab(sp.tab);
  const [session, followed, peers, players, staff] = await Promise.all([
    getSession().catch(() => null),
    getFollowedOrgIds(),
    getConferencePeers(org.id, org.conferenceAbbr),
    getProgramPlayers(org.id),
    getProgramStaff(org.id),
  ]);
  const isEmployer = session?.user.kind === "employer";
  const isOwnProgram = isEmployer && session?.org?.id === org.id;
  const showHiring = !session || isEmployer;
  const headCoaches = staff.find((u) => u.unit === "head")?.people ?? [];

  const stats = [
    { value: counts.staff, label: "Staff listed" },
    { value: counts.coached, label: "Alumni coaches" },
    {
      // Sample listings: the dashed chip sits by the number it qualifies (it fits beside the value at 390px).
      value:
        counts.jobs > 0 && counts.sampleJobs === counts.jobs ? (
          <span className="inline-flex items-center gap-2">
            {counts.jobs}
            <SampleChip label="Sample" />
          </span>
        ) : (
          counts.jobs
        ),
      label: "Open jobs",
    },
  ];
  const tabs = [
    { href: tabHref(org.slug, "staff"), label: "Staff", count: counts.staff, active: tab === "staff" },
    { href: tabHref(org.slug, "alumni"), label: "Alumni coaches", count: counts.coached, active: tab === "alumni" },
    { href: tabHref(org.slug, "jobs"), label: "Jobs", count: counts.jobs, active: tab === "jobs" },
  ];
  const tabLabel = tab === "alumni" ? "Alumni coaches" : tab === "jobs" ? "Jobs" : "Staff";

  const rail = (
    <>
      <ConferencePeersCard peers={peers} conferenceAbbr={org.conferenceAbbr} conferenceName={org.conference} />
      <CoachesFromHereCard players={players} shortName={org.shortName} allHref={`${tabHref(org.slug, "alumni")}#played`} />
      {showHiring && <HiringCard programShortName={org.shortName} isOwnProgram={!!isOwnProgram} />}
    </>
  );

  return (
    <TwoColumnLayout railLabel={`More about ${org.shortName}`} rail={rail}>
      <ProgramJsonLd org={org} url={`${origin}${tabHref(org.slug, "staff")}`} origin={origin} headCoaches={headCoaches} />
      <ProgramHeader
        org={org}
        stats={stats}
        tabs={tabs}
        actions={
          <>
            <FollowButton orgId={org.id} shortName={org.shortName} initialFollowing={followed.includes(org.id)} className="max-md:flex-1" />
            <ProgramMoreMenu path={tabHref(org.slug, "staff")} name={org.shortName} />
          </>
        }
      />
      <div role="tabpanel" aria-label={`${tabLabel}, ${org.shortName}`} className="flex min-w-0 flex-col gap-2 md:gap-3">
        <Suspense key={`${tab}-${page}`} fallback={<ProgramListSkeleton shape={tab === "jobs" ? "tile" : "circle"} />}>
          {tab === "staff" && <StaffTab org={org} />}
          {tab === "alumni" && <AlumniTab org={org} page={page} />}
          {tab === "jobs" && <JobsTab org={org} canPost={!!isOwnProgram} />}
        </Suspense>
      </div>
    </TwoColumnLayout>
  );
}
