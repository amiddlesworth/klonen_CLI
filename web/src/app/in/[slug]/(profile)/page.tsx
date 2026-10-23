import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AboutCard } from "@/components/profile/AboutCard";
import { EducationCard, PlayingCard } from "@/components/profile/CareerEntries";
import { ExperienceCard } from "@/components/profile/ExperienceCard";
import {
  buildLedger,
  buildTree,
  coachingSeasons,
  coachingStops,
  currentHeadline,
  firstSeason,
  otherSportRoleCount,
  staffOnlyRoleCount,
  stripStints,
  undatedRoleCount,
} from "@/components/profile/model";
import type { ProfileViewer } from "@/components/profile/ProfileActions";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { AlsoViewedCard, CurrentProgramCard, ProfileBreadcrumb, SameTreeCard, sameTreeInferred } from "@/components/profile/RailCards";
import { TreeCard } from "@/components/profile/TreeCard";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import { BRAND } from "@/lib/brand";
import { getDemoAccounts } from "@/lib/queries/shell";
import {
  getAlmaMaterOrg,
  getAlsoViewed,
  getConnectionState,
  getProfileCached,
  getProfileTreeCached,
  getProgramCard,
  getSameTree,
  type ConnectionState,
} from "@/lib/queries/profile";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfileCached(slug);
  // Unknown slug: the segment layout answers with a real 404 before anything streams.
  if (!profile) return { title: "Coach not found", robots: { index: false } };
  const { person, currentOrg } = profile;
  if (person.isDemo) {
    // A fictional demo candidate: never indexed, and a link unfurl says it is invented (ARCHITECTURE
    // "Demo data honesty", DESIGN §12), since snippets carry none of the page's Demo labels.
    const description = `Fictional demo candidate for the ${BRAND.name} hiring-pipeline demo. Not a real coach.`;
    return {
      title: `${person.fullName} (demo)`,
      description,
      robots: { index: false, follow: false },
      openGraph: { title: `${person.fullName} (demo) · ${BRAND.name}`, description, siteName: BRAND.name },
    };
  }
  const headline = currentHeadline(profile.experience.flatMap((g) => g.roles), currentOrg?.id ?? null, person.currentTitle);
  const role = [headline, currentOrg?.name].filter(Boolean).join(" at ");
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

  const tree = await getProfileTreeCached(person.id);
  const treeIds = [...tree.mentors, ...tree.peers, ...tree.mentees].map((l) => l.person.id);
  const conference = currentOrg?.conferenceAbbr ?? null;
  // A fictional demo candidate is two steps from no one: no Same tree.
  const sameTreeP = currentOrg && !person.isDemo ? getSameTree(person.id, currentOrg.id, treeIds) : Promise.resolve([]);
  const [accounts, program, sameTree, alsoViewed, almaOrg, connection] = await Promise.all([
    getDemoAccounts().catch(() => []),
    currentOrg ? getProgramCard(currentOrg.id) : Promise.resolve(null),
    sameTreeP,
    // Nobody twice on one page: People also viewed leaves out the tree card and Same tree.
    conference ? sameTreeP.then((st) => getAlsoViewed(person.id, person.slug, conference, [...treeIds, ...st.map((l) => l.person.id)])) : Promise.resolve([]),
    person.almaMater ? getAlmaMaterOrg(person.almaMater) : Promise.resolve(null),
    session?.person && !isOwner && person.claimed ? getConnectionState(session.person.id, person.id) : Promise.resolve<ConnectionState>("none"),
  ]);

  // Rows from the source, newest first (getProfile orders by the pipeline's sort order), each with its
  // sport: every coaching number and the strip count football coaching only (model.ts isFootballCoaching);
  // roles in other sports are listed under their sport.
  const rows = [...profile.experience.flatMap((g) => g.roles), ...playing];
  const ledger = buildLedger(rows);
  const seasons = coachingSeasons(rows);
  const first = firstSeason(rows);
  const treeModel = buildTree(tree, firstName, currentOrg?.slug ?? null, { id: person.id, fullName: person.fullName });
  const headline = currentHeadline(rows, currentOrg?.id ?? null, person.currentTitle);
  const undatedRoles = undatedRoleCount(rows);
  const strip = stripStints(rows);
  const ledgerInferred = ledger.some((g) => g.inferred || g.items.some((i) => i.kind === "role" && i.inferred && g.roleCount > 1));
  const playingInferred = playing.some((r) => !r.yearsExplicit && (r.startYear || r.endYear));
  const sameInferred = sameTreeInferred(sameTree);
  // Every page that shows an inferred year explains the mark once (§6.2): the Experience legend, or,
  // without an Experience list, the first card below that shows one.
  const anyInferred = ledgerInferred || playingInferred || treeModel.inferred || sameInferred;
  const explainIn = !anyInferred
    ? null
    : ledger.length
      ? "experience"
      : playing.length
        ? "playing"
        : treeModel.groups.length && treeModel.inferred
          ? "tree"
          : "same-tree";
  const sources = [...new Set([person.sourceUrl, ...profile.sources].filter((u): u is string => !!u))];

  const profilePerson = { id: person.id, slug: person.slug, fullName: person.fullName, firstName, claimed: person.claimed };
  // Structured data only for real coaches: a fictional demo candidate must not tell search engines it works at a real college.
  const jsonLd = person.isDemo
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Person",
        name: person.fullName,
        ...(headline ? { jobTitle: headline } : {}),
        ...(currentOrg ? { worksFor: { "@type": "SportsOrganization", name: currentOrg.name, ...(program?.athleticsUrl ? { url: program.athleticsUrl } : {}) } } : {}),
        ...(person.almaMater ? { alumniOf: { "@type": "CollegeOrUniversity", name: person.almaMater } } : {}),
      };

  return (
    <TwoColumnLayout
      breadcrumb={<ProfileBreadcrumb name={person.fullName} program={currentOrg} demo={person.isDemo ? (viewer === "employer" ? "employer" : "other") : undefined} />}
      railLabel="Program and related people"
      rail={
        <>
          {program && <CurrentProgramCard program={program} />}
          {currentOrg && (
            <SameTreeCard
              links={sameTree}
              firstName={firstName}
              programShortName={currentOrg.shortName}
              signedIn={!!session}
              accounts={accounts}
              explainInferred={explainIn === "same-tree"}
            />
          )}
          {conference && <AlsoViewedCard people={alsoViewed} conferenceAbbr={conference} />}
        </>
      }
    >
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <ProfileHeader
        person={{ ...profilePerson, headline, isDemo: person.isDemo }}
        currentOrg={currentOrg}
        viewer={viewer}
        accounts={accounts}
        connection={connection}
        stats={{ seasons: seasons.length || null, seasonsPlus: undatedRoles > 0, stops: coachingStops(rows), treeSize: treeModel.unique, first }}
        sources={sources}
        hasRoles={rows.length > 0}
      />
      {/* A demo candidate's About only repeats the Demo banner in the header, so it has none. */}
      {!person.isDemo && (
        <AboutCard about={person.about} excerpt={person.bioExcerpt} sourceUrl={person.sourceUrl ?? sources[0] ?? null} firstName={firstName} slug={slug} owner={isOwner} />
      )}
      <ExperienceCard
        groups={ledger}
        strip={strip}
        seasons={seasons.length}
        undatedRoles={undatedRoles}
        personName={person.fullName}
        firstName={firstName}
        slug={slug}
        owner={isOwner}
        showInferredKey={explainIn === "experience"}
        otherSportRoles={otherSportRoleCount(rows)}
        staffOnlyRoles={staffOnlyRoleCount(rows)}
        isDemo={person.isDemo}
      />
      <PlayingCard rows={playing} personName={person.fullName} explainInferred={explainIn === "playing"} />
      <TreeCard model={treeModel} slug={slug} firstName={firstName} personName={person.fullName} explainInferred={explainIn === "tree"} isDemo={person.isDemo} />
      <EducationCard almaMater={person.almaMater} org={almaOrg} />
    </TwoColumnLayout>
  );
}
