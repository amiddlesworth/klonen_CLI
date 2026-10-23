import { Briefcase } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** /jobs/[id] for an id that doesn't exist (or isn't a number). */
export default function JobNotFound() {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <CardHeader as="h1" title="Job not found" />
        <EmptyState
          icon={Briefcase}
          title="This job isn't listed anymore, or the link is wrong."
          description="Open jobs at Division III programs are all on the Jobs page."
          action={<ButtonLink href="/jobs">Browse jobs</ButtonLink>}
          spacing="lg"
        />
      </Card>
    </SingleColumnLayout>
  );
}
