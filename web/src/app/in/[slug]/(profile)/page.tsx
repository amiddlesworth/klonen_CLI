import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { StripStint } from "@/components/data/SeasonStrip";
import { AboutCard } from "@/components/profile/AboutCard";
import { EducationCard, PlayingCard } from "@/components/profile/CareerEntries";
import { ExperienceCard } from "@/components/profile/ExperienceCard";
import { buildLedger, buildTree, coachingSeasons, firstSeason } from "@/components/profile/model";
import type { ProfileViewer } from "@/components/profile/ProfileActions";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { AlsoViewedCard, CurrentProgramCard, ProfileBreadcrumb, SameTreeCard } from "@/components/profile/RailCards";
import { TreeCard } from "@/components/profile/TreeCard";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import { BRAND } from "@/lib/brand";
import { getDemoAccounts } from "@/lib/queries/shell";
import {
  getAlmaMaterOrg,
  getAlsoViewed,
  getConnectionState,
  getProfileCached,
  getProgramCard,
  getSameTree,
  getTreeCached,
  type ConnectionState,
} from "@/lib/queries/profile";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileCached(slug);
  // Unknown slug: the page calls notFound(), which adds robots noindex; loading.tsx streams the
  // shell first, so the HTTP status stays 200 in this setup.
  if (!profile) return { title: "Coach not found", robots: { index: false } };
  const { person, currentOrg } = profile;
  const role = [person.currentTitle, currentOrg?.name].filter(Boolean).join(" at ");
  const description = `${person.fullName}${role ? `, ${role}` : ""}. Coaching career, coaching tree and education, built from public sources.`;
  return {
    title: person.fullName,
    description,
    openGraph: { title: `${person.fullName} · ${BRAND.name}`, description, type: "profile", siteName: BRAND.name },
  };
}

/** Coach profile /in/[slug] (DESIGN.md §8.4, design/reference/profile.html). */
export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getProfileCached(slug);
  if (!profile) notFound();
  const { person, currentOrg, playing } = profile;

  const session = await getSession().catch(() => null);
  const isOwner = session?.user.kind === "coach" && session.person?.slug === slug;
  const viewer: ProfileViewer = isOwner ? "owner" : !session ? "visitor" : session.user.kind === "employer" ? "employer" : "coach";
  const firstName = person.firstName || person.fullName.split(" ")[0];

  const tree = await getTreeCached(person.id);
  const treeIds = [...tree.mentors, ...tree.peers, ...tree.mentees].map((l) => l.person.id);
  const conference = currentOrg?.conferenceAbbr ?? null;
  const [accounts, program, sameTree, alsoViewed, almaOrg, connection] = await Promise.all([
    getDemoAccounts().catch(() => []),
    currentOrg ? getProgramCard(currentOrg.id) : Promise.resolve(null),
    currentOrg ? getSameTree(person.id, currentOrg.id, treeIds) : Promise.resolve([]),
    conference ? getAlsoViewed(person.id, person.slug, conference) : Promise.resolve([]),
    person.almaMater ? getAlmaMaterOrg(person.almaMater) : Promise.resolve(null),
    session?.person && !isOwner && person.claimed ? getConnectionState(session.person.id, person.id) : Promise.resolve<ConnectionState>("none"),
  ]);

  // Rows from the source, newest first (getProfile orders by the pipeline's sort order).
  const rows = [...profile.experience.flatMap((g) => g.roles), ...playing];
  const ledger = buildLedger(rows);
  const seasons = coachingSeasons(rows);
  const first = firstSeason(rows);
  const treeModel = buildTree(tree, firstName, currentOrg?.slug ?? null);
  const strip: StripStint[] = rows
    .filter((r) => !r.asPlayer)
    .map((r) => ({
      orgId: r.org.id,
      shortName: r.org.shortName,
      name: r.org.name,
      role: r.role,
      roleGroup: r.roleGroup,
      startYear: r.startYear,
      endYear: r.endYear,
      isCurrent: r.isCurrent,
    }));
  const ledgerInferred = ledger.some((g) => g.inferred || g.items.some((i) => i.kind === "role" && i.inferred && g.roleCount > 1));
  const playingInferred = playing.some((r) => !r.yearsExplicit && (r.startYear || r.endYear));
  const sources = [...new Set([person.sourceUrl, ...profile.sources].filter((u): u is string => !!u))];

  const profilePerson = { id: person.id, slug: person.slug, fullName: person.fullName, firstName, claimed: person.claimed };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.fullName,
    ...(person.currentTitle ? { jobTitle: person.currentTitle } : {}),
    ...(currentOrg ? { worksFor: { "@type": "SportsOrganization", name: currentOrg.name, ...(program?.athleticsUrl ? { url: program.athleticsUrl } : {}) } } : {}),
    ...(person.almaMater ? { alumniOf: { "@type": "CollegeOrUniversity", name: person.almaMater } } : {}),
  };

  return (
    <TwoColumnLayout
      breadcrumb={<ProfileBreadcrumb name={person.fullName} program={currentOrg} />}
      railLabel="Program and related people"
      rail={
        <>
          {program && <CurrentProgramCard program={program} />}
          {currentOrg && (
            <SameTreeCard links={sameTree} firstName={firstName} programShortName={currentOrg.shortName} signedIn={!!session} accounts={accounts} />
          )}
          {conference && <AlsoViewedCard people={alsoViewed} conferenceAbbr={conference} />}
        </>
      }
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProfileHeader
        person={{ ...profilePerson, currentTitle: person.currentTitle, isDemo: person.isDemo }}
        currentOrg={currentOrg}
        viewer={viewer}
        accounts={accounts}
        connection={connection}
        stats={{ seasons: seasons.length || null, stops: ledger.length, treeSize: treeModel.unique, first }}
        sources={sources}
        hasRoles={rows.length > 0}
      />
      <AboutCard about={person.about} excerpt={person.bioExcerpt} sourceUrl={person.sourceUrl ?? sources[0] ?? null} firstName={firstName} slug={slug} owner={isOwner} />
      <ExperienceCard
        groups={ledger}
        strip={strip}
        seasons={seasons.length}
        personName={person.fullName}
        firstName={firstName}
        slug={slug}
        owner={isOwner}
        showInferredKey={ledgerInferred}
      />
      <PlayingCard rows={playing} personName={person.fullName} explainInferred={playingInferred && (!ledgerInferred || !ledger.length)} />
      <TreeCard model={treeModel} slug={slug} firstName={firstName} personName={person.fullName} />
      <EducationCard almaMater={person.almaMater} org={almaOrg} />
    </TwoColumnLayout>
  );
}
