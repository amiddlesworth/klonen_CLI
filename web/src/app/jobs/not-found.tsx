import { Briefcase } from "lucide-react";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * /jobs/[id] for an id that doesn't exist or isn't a number (raised by app/jobs/[id]/layout.tsx,
 * so the response is a real 404). The h1 uses the page-title scale of every jobs route.
 */
export default function JobNotFound() {
  return (
    <SingleColumnLayout>
      <Card padding="main" aria-labelledby="job-not-found">
        <h1 id="job-not-found" className="text-display-sm">
          Job not found
        </h1>
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
