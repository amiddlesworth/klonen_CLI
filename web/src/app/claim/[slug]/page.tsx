import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ClaimFlow } from "@/components/claim/ClaimFlow";
import { CoachOnlyNotice } from "@/components/claim/CoachOnlyNotice";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, SampleChip, UnclaimedChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
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
  return {
    title: `Claim ${subject.person.fullName}'s profile`,
    description: `Confirm it's you, review the career record built from public sources and publish ${subject.person.fullName}'s profile on ${BRAND.name}.`,
    robots: { index: false, follow: false },
  };
}

/** /claim/[slug] (§8.11): confirm identity, review every stint, publish. Never changes the person's record. */
export default async function ClaimPage({ params }: Params) {
  const { slug } = await params;
  const [subject, session] = await Promise.all([loadSubject(slug), getSession()]);
  if (!subject) notFound();
  const { person, currentOrg } = subject;
  const first = person.firstName ?? person.fullName.split(" ")[0];

  if (session?.user.kind === "employer") {
    const coach = (await getDemoAccounts().catch(() => [])).find((a) => a.role === "coach") ?? null;
    return (
      <SingleColumnLayout>
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
      <SingleColumnLayout>
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

  const headline = [person.currentTitle, currentOrg?.shortName].filter(Boolean).join(" · ");
  // The h1 is text-title in every state of this page (flow, already claimed, not found, error,
  // athletic director), matching the settings pages, so the type scale never jumps between states.
  const identityBlock = (done: boolean) => (
    <div className="flex items-start gap-3">
      <Avatar name={person.fullName} tintKey={person.slug} size={48} />
      <div className="min-w-0 flex-1">
        <h1 className="text-title">Claim your profile</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
          <TextLink href={`/in/${person.slug}`} variant="plain" target24 className="font-semibold text-fg-1">
            {person.fullName}
          </TextLink>
          {person.isDemo ? (
            <>
              {!done && <UnclaimedChip />}
              <SampleChip label="Demo" />
            </>
          ) : done ? (
            // The claim is recorded, but the public record stays Unclaimed: say so on the record itself.
            <Chip kind="sample" title="Your public record stays Unclaimed in this demo">
              Demo
            </Chip>
          ) : (
            <UnclaimedChip />
          )}
        </p>
        {headline && <p className="mt-0.5 text-small text-fg-2">{headline}</p>}
      </div>
    </div>
  );

  const ownSlug = session?.person?.slug ?? null;
  const notice =
    session && ownSlug && ownSlug !== person.slug ? (
      <p>
        You&apos;re signed in as {session.user.name}. In the live product you can claim only your own profile; this demo lets you walk through {first}&apos;s.{" "}
        <TextLink href={`/claim/${ownSlug}`} variant="inline">
          Claim your own profile
        </TextLink>
      </p>
    ) : null;

  return (
    <SingleColumnLayout>
      <ClaimFlow
        subject={subject}
        identity={identityBlock(false)}
        identityDone={identityBlock(true)}
        notice={notice}
        saves={!!session && session.user.kind === "coach"}
      />
    </SingleColumnLayout>
  );
}
