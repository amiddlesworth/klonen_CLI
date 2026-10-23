import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ShieldCheck, UserRound } from "lucide-react";
import { ClaimFlow, type ClaimMode } from "@/components/claim/ClaimFlow";
import { CoachOnlyNotice } from "@/components/claim/CoachOnlyNotice";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Avatar } from "@/components/ui/Avatar";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SampleChip, UnclaimedChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { PAGE_TITLE } from "@/components/ui/PageHeader";
import { TextLink } from "@/components/ui/TextLink";
import { BRAND } from "@/lib/brand";
import { getClaimSubject } from "@/lib/queries/claim";
import { getDemoAccounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";

type Params = { params: Promise<{ slug: string }> };

const loadSubject = cache((slug: string) => getClaimSubject(slug));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const subject = await loadSubject(slug);
  if (!subject) return { title: "Profile not found", robots: { index: false } };
  const { fullName, isDemo } = subject.person;
  return {
    title: `Claim ${fullName}'s profile`,
    description: isDemo
      ? `${fullName} is a fictional demo candidate on ${BRAND.name}, so there's no one to claim this profile.`
      : `Confirm it's you, review the career record built from public sources and publish ${fullName}'s profile on ${BRAND.name}.`,
    robots: { index: false, follow: false },
  };
}

/**
 * /claim/[slug] (§8.11): confirm identity, review every stint, publish. Never changes the person's record.
 * The (flow) layout has already answered an unknown slug with a 404; the guard below only narrows types.
 */
export default async function ClaimPage({ params }: Params) {
  const { slug } = await params;
  const [subject, session] = await Promise.all([loadSubject(slug), getSession()]);
  if (!subject) notFound();
  const { person, currentOrg } = subject;
  const first = person.firstName ?? person.fullName.split(" ")[0];
  const ownSlug = session?.person?.slug ?? null;
  // Wayfinding (audit X11): back to the profile being claimed, in the breadcrumb row (a back link on phone).
  const crumb = <Breadcrumb items={[{ label: person.fullName, href: `/in/${person.slug}` }]} current="Claim profile" phone="back" />;

  // A fictional demo candidate (§6.4): as its profile says, there is no one to claim it.
  if (person.isDemo) {
    return (
      <SingleColumnLayout breadcrumb={crumb}>
        <Card padding="main">
          <CardHeader as="h1" title="Claim your profile" />
          <EmptyState
            icon={UserRound}
            title="There's no one to claim this profile."
            description={
              <>
                <SampleChip label="Demo" className="mr-1.5 align-[1px]" />
                {person.fullName} is a fictional demo candidate: the name and career were invented for the hiring-pipeline demo.
              </>
            }
            action={
              session?.user.kind === "coach" && ownSlug ? (
                <ButtonLink href={`/claim/${ownSlug}`}>Claim your own profile</ButtonLink>
              ) : (
                <ButtonLink href={`/in/${person.slug}`}>View profile</ButtonLink>
              )
            }
            spacing="lg"
          />
        </Card>
      </SingleColumnLayout>
    );
  }

  if (session?.user.kind === "employer") {
    const coach = (await getDemoAccounts().catch(() => [])).find((a) => a.role === "coach") ?? null;
    return (
      <SingleColumnLayout breadcrumb={crumb}>
        <CoachOnlyNotice
          title="Claim your profile"
          icon="person"
          message="Only the coach can claim a profile."
          description={`You're signed in as ${session.user.name}, an athletic director. A coach claims a profile by confirming a school email. Switch to the coach demo to walk through it for ${person.fullName}.`}
          coach={coach}
        />
      </SingleColumnLayout>
    );
  }

  if (person.claimed) {
    return (
      <SingleColumnLayout breadcrumb={crumb}>
        <Card padding="main">
          <CardHeader as="h1" title="Claim your profile" />
          <EmptyState
            icon={ShieldCheck}
            title={`${person.fullName}'s profile is already claimed.`}
            description="If this is you and you didn't claim it, report it from the profile's More menu."
            action={<ButtonLink href={`/in/${person.slug}`}>View profile</ButtonLink>}
            spacing="lg"
          />
        </Card>
      </SingleColumnLayout>
    );
  }

  // The profile header's words: "{headline} at {Program}" (currentHeadline, as ProfileHeader and the step 3 preview).
  const headline = person.headline && currentOrg ? `${person.headline} at ${currentOrg.name}` : (person.headline ?? currentOrg?.name ?? null);
  // The h1 is PAGE_TITLE in every state of this page (flow, already claimed, not found, error,
  // athletic director), as on every non-entity page, so the type scale never jumps between states.
  // The avatar is 56, the size of every person sub-page header (tree, claim; the profile alone has 80).
  // The chip stays Unclaimed after the walk-through: the public record doesn't change (the success
  // card says so), and a Demo chip next to a real coach would read as "this person is fictional".
  const identity = (
    <div className="flex items-start gap-3">
      <Avatar name={person.fullName} tintKey={person.slug} size={56} />
      <div className="min-w-0 flex-1">
        <h1 className={PAGE_TITLE}>Claim your profile</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
          <TextLink href={`/in/${person.slug}`} variant="plain" target24 className="font-semibold text-fg-1">
            {person.fullName}
          </TextLink>
          <UnclaimedChip />
        </p>
        {headline && <p className="mt-0.5 text-small text-fg-2">{headline}</p>}
      </div>
    </div>
  );

  // Only the coach demo claiming its own profile records anything (lib/actions/claim.ts).
  const mode: ClaimMode = !session ? "visitor" : ownSlug === person.slug ? "own" : "other";
  const notice =
    mode === "other" && session ? (
      <p>
        You&apos;re signed in as {session.user.name}. In the live product you can claim only your own profile; this demo lets you walk through {first}&apos;s
        without saving it.
        {ownSlug && (
          <>
            {" "}
            <TextLink href={`/claim/${ownSlug}`} variant="inline">
              Claim your own profile
            </TextLink>
          </>
        )}
      </p>
    ) : null;

  return (
    <SingleColumnLayout breadcrumb={crumb}>
      <ClaimFlow subject={subject} identity={identity} notice={notice} mode={mode} />
    </SingleColumnLayout>
  );
}
