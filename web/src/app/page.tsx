import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BRAND } from "@/lib/brand";
import { getSession } from "@/lib/session";

/** Placeholder: the landing feature replaces this page. Signed-in viewers go to their feed. */
export default async function HomePage() {
  if (await getSession().catch(() => null)) redirect("/feed");
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <h1 className="text-display max-md:text-display-sm">{BRAND.tagline}</h1>
        <p className="mt-1 text-subtitle text-fg-2">{BRAND.description}</p>
        <EmptyState
          icon={Search}
          title="The home page is on its way."
          description="Meanwhile, look up a coach or a program."
          action={<ButtonLink href="/search">Search coaches and programs</ButtonLink>}
        />
      </Card>
    </SingleColumnLayout>
  );
}
