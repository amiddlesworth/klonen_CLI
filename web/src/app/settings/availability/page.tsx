import type { Metadata } from "next";
import { AvailabilityForm } from "@/components/claim/AvailabilityForm";
import { CoachOnlyNotice } from "@/components/claim/CoachOnlyNotice";
import { regionForState } from "@/components/claim/options";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getAvailabilitySettings, getRegistryPrograms } from "@/lib/queries/claim";
import { getDemoAccounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Open to opportunities",
  description: "Choose who can see that you're open to new coaching roles. Never shown on your public profile.",
  robots: { index: false, follow: false },
};

/** /settings/availability (§8.12): the coach's private Open to opportunities setting. Coach demo only. */
export default async function AvailabilityPage() {
  const session = await getSession();

  if (!session || session.user.kind !== "coach" || !session.person) {
    const coach = (await getDemoAccounts().catch(() => [])).find((a) => a.role === "coach") ?? null;
    return (
      <SingleColumnLayout>
        <CoachOnlyNotice
          title="Open to opportunities"
          message={session ? "This setting belongs to a coach's account." : "Sign in as a coach to use this setting."}
          description={
            session
              ? `You're signed in as ${session.user.name}, an athletic director. Coaches use this page to tell the people hiring, privately, that they'd consider a new role. Switch to the coach demo to try it.`
              : "Coaches use this page to tell the people hiring, privately, that they'd consider a new role. It's never shown on a public profile."
          }
          coach={coach}
        />
      </SingleColumnLayout>
    );
  }

  const [settings, programs] = await Promise.all([getAvailabilitySettings(session.person.id), getRegistryPrograms()]);
  const currentOrgId = session.person.currentOrgId;
  const org = session.org;
  const currentProgram = org
    ? { id: org.id, name: org.name, shortName: org.shortName, conferenceAbbr: org.conferenceAbbr, conference: org.conference, level: org.level, state: org.state }
    : null;
  const regionCounts: Record<string, number> = {};
  for (const p of programs) {
    const r = regionForState(p.state);
    if (r) regionCounts[r.value] = (regionCounts[r.value] ?? 0) + 1;
  }

  return (
    <SingleColumnLayout breadcrumb={<Breadcrumb items={[{ label: "Settings", href: "/settings" }]} current="Open to opportunities" phone="back" />}>
      <AvailabilityForm
        initial={settings}
        programs={programs.filter((p) => p.id !== currentOrgId)}
        currentProgram={currentProgram}
        regionCounts={regionCounts}
      />
    </SingleColumnLayout>
  );
}
