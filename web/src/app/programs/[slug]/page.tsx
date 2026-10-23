import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Briefcase } from "lucide-react";
import { AlumniTab } from "@/components/program/AlumniTab";
import { FollowButton } from "@/components/program/FollowButton";
import { JobsTab } from "@/components/program/JobsTab";
import { LightOrgPage } from "@/components/program/LightOrgPage";
import { ProgramHeader } from "@/components/program/ProgramHeader";
import { ProgramJsonLd } from "@/components/program/ProgramJsonLd";
import { ProgramMoreMenu } from "@/components/program/ProgramMoreMenu";
import {
  COACHES_FROM_HERE_LIMIT,
  CoachesFromHereCard,
  ConferencePeersCard,
  HiringCard,
  STAFF_NOT_READ,
  YourHiringCard,
} from "@/components/program/ProgramRail";
import { ProgramListSkeleton } from "@/components/program/ProgramSkeleton";
import { redirectToCanonicalSlug, resolveProgramSlug } from "@/components/program/resolve";
import { rangeHasInferred } from "@/components/program/LedgerRange";
import { StaffTab } from "@/components/program/StaffTab";
import { ButtonLink } from "@/components/ui/Button";
import { SampleChip } from "@/components/ui/Chip";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import type { Stat } from "@/components/data/StatGroup";
import { BRAND } from "@/lib/brand";
import { levelFull } from "@/lib/format";
import {
  getConferencePeers,
  getFollowedOrgIds,
  getProgramCounts,
  getProgramPlayers,
  getProgramStaff,
  getStaffStints,
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
  const sp = await searchParams;
  const org = await resolveProgramSlug(slug);
  if (!org) notFound();
  // Crawlers get metadata before the page streams, so the uppercase-slug 308 (query kept) happens here first.
  redirectToCanonicalSlug(slug, org, sp);
  const tab = org.inRegistry ? parseTab(sp.tab) : "staff";
  const [counts, origin] = await Promise.all([getProgramCounts(org.id), siteOrigin()]);
  const base = org.inRegistry ? `${org.name} football` : org.name;
  const title = tab === "alumni" ? `Alumni coaches · ${base}` : tab === "jobs" ? `Jobs · ${base}` : org.inRegistry ? `${base} staff` : base;
  const description = describe(org, counts);
  const canonical = `${origin}${tabHref(org.slug, tab)}`;
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
 * coaches from here and a hiring card; every other organization gets the lighter page. A signed-in
 * viewer on their own program (session org) sees "your program" copy instead of Follow.
 */
export default async function ProgramPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const org = await resolveProgramSlug(slug);
  if (!org) notFound();
  redirectToCanonicalSlug(slug, org, sp);

  const origin = await siteOrigin();
  const page = parsePage(sp.page);
  const counts = await getProgramCounts(org.id);

  if (!org.inRegistry) {
    return <LightOrgPage org={org} counts={counts} page={page} url={`${origin}/programs/${org.slug}`} origin={origin} />;
  }

  const tab = parseTab(sp.tab);
  const session = await getSession().catch(() => null);
  const [followed, peers, players, staff, staffStints] = await Promise.all([
    getFollowedOrgIds(session?.user.id),
    getConferencePeers(org.id, org.conferenceAbbr),
    getProgramPlayers(org.id),
    getProgramStaff(org.id),
    getStaffStints(org.id),
  ]);
  const isEmployer = session?.user.kind === "employer";
  // The viewer's own program, from the session: the coach's current program or the AD's program.
  const isOwnProgram = !!session && (session.org?.id === org.id || session.person?.currentOrgId === org.id);
  const isOwnEmployer = isOwnProgram && isEmployer;
  const isOwnCoach = isOwnProgram && !isEmployer;
  const headCoaches = staff.find((u) => u.unit === "head")?.people ?? [];
  const staffRead = counts.staff > 0;

  const stats: Stat[] = [
    // A registry program with no staff rows means its staff page wasn't read, not that it has no staff.
    staffRead ? { value: counts.staff, label: "Staff listed" } : { value: <span aria-hidden="true">–</span>, label: STAFF_NOT_READ },
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
    // The fourth column adds what the tabs don't count (§8.6 asks for a founded/restarted year, which the data lacks).
    // Linked only when the "Played here" list it points to exists.
    { value: counts.played, label: "Coaches from here", href: counts.played ? `${tabHref(org.slug, "alumni")}#played` : undefined, hideOnPhone: true },
  ];
  const tabs = [
    { href: tabHref(org.slug, "staff"), label: "Staff", count: staffRead ? counts.staff : null, active: tab === "staff" },
    { href: tabHref(org.slug, "alumni"), label: "Alumni coaches", count: counts.coached, active: tab === "alumni" },
    { href: tabHref(org.slug, "jobs"), label: "Jobs", count: counts.jobs, active: tab === "jobs" },
  ];
  const tabLabel = tab === "alumni" ? "Alumni coaches" : tab === "jobs" ? "Jobs" : "Staff";

  // Dotted years are explained once per page: by the staff list when it shows one, else by the rail card.
  const staffExplains = tab === "staff" && staff.some((u) => u.people.some((p) => rangeHasInferred(staffStints.get(p.id) ?? [])));
  const railShowsInferred = players.slice(0, COACHES_FROM_HERE_LIMIT).some((e) => rangeHasInferred(e.stints, "compact"));

  const rail = (
    <>
      {isOwnEmployer && (
        <YourHiringCard programShortName={org.shortName} jobs={counts.jobs} sampleJobs={counts.sampleJobs} jobsHref={tabHref(org.slug, "jobs")} />
      )}
      <ConferencePeersCard peers={peers} conferenceAbbr={org.conferenceAbbr} conferenceName={org.conference} />
      {/* On the Alumni coaches tab the main column already lists these people under "Played here". */}
      {tab !== "alumni" && (
        <CoachesFromHereCard
          players={players}
          shortName={org.shortName}
          allHref={`${tabHref(org.slug, "alumni")}#played`}
          explainInferred={railShowsInferred && !staffExplains}
        />
      )}
      {!isOwnProgram && (!session || isEmployer) && <HiringCard />}
    </>
  );

  const actions = isOwnEmployer ? (
    <ButtonLink href="/employers/jobs/new" variant="primary" icon={Briefcase} phone="large" className="max-md:flex-1">
      Post a job
    </ButtonLink>
  ) : isOwnCoach && session?.person ? (
    <ButtonLink href={`/in/${session.person.slug}`} phone="large" className="max-md:flex-1">
      Your profile
    </ButtonLink>
  ) : (
    <FollowButton orgId={org.id} shortName={org.shortName} initialFollowing={followed.includes(org.id)} className="max-md:flex-1" />
  );

  return (
    <TwoColumnLayout railLabel={`More about ${org.shortName}`} rail={rail}>
      <ProgramJsonLd org={org} url={`${origin}${tabHref(org.slug, "staff")}`} origin={origin} headCoaches={headCoaches} />
      <ProgramHeader
        org={org}
        stats={stats}
        tabs={tabs}
        context={isOwnProgram ? "your program" : undefined}
        actions={
          <>
            {actions}
            <ProgramMoreMenu path={tabHref(org.slug, "staff")} name={org.shortName} />
          </>
        }
      />
      <div role="tabpanel" aria-label={`${tabLabel}, ${org.shortName}`} className="flex min-w-0 flex-col gap-2 md:gap-3">
        <Suspense key={`${tab}-${page}`} fallback={<ProgramListSkeleton shape={tab === "jobs" ? "tile" : "circle"} />}>
          {tab === "staff" && <StaffTab org={org} viewerPersonId={isOwnCoach ? session?.person?.id : null} />}
          {tab === "alumni" && <AlumniTab org={org} page={page} />}
          {tab === "jobs" && <JobsTab org={org} canPost={isOwnEmployer} />}
        </Suspense>
      </div>
    </TwoColumnLayout>
  );
}
