import type { Metadata } from "next";
import { Network } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";
import { ButtonLink } from "@/components/ui/Button";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "My network" };

/** Placeholder for the Network tab. */
export default async function NetworkPage() {
  const session = await getSession();
  const slug = session?.person?.slug;
  return (
    <PlaceholderPage
      title="My network"
      icon={Network}
      message="Your network is on its way."
      description="Your coaching tree and connections will show up here."
      action={slug ? <ButtonLink href={`/in/${slug}/tree`}>View your coaching tree</ButtonLink> : undefined}
    />
  );
}
