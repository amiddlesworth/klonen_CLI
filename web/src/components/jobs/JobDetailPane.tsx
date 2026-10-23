import { Card } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/TextLink";
import type { JobDetail } from "@/lib/queries/jobsx";
import type { PersonSummary } from "@/lib/queries/people";
import { parseDescription } from "./description";
import type { JobProof } from "./JobCard";
import { JobDescriptionInline } from "./JobDescription";
import { JobHeader } from "./JobHeader";
import { ProgramPeople } from "./ProgramPeople";

type JobDetailPaneProps = {
  job: JobDetail;
  people: PersonSummary[];
  peopleTotal: number;
  proof: JobProof | null;
};

/**
 * The selected job on /jobs at lg and up (list left, job right). One card: header, description
 * sections and the program's people, split by dividers; the pane scrolls on its own and stays in
 * view while the list scrolls.
 */
export function JobDetailPane({ job, people, peopleTotal, proof }: JobDetailPaneProps) {
  const sections = parseDescription(job.description);
  return (
    <Card
      as="section"
      aria-labelledby="pane-title"
      className="hidden lg:sticky lg:top-[calc(var(--nav-h)+20px)] lg:block lg:max-h-[calc(100dvh-var(--nav-h)-40px)] lg:overflow-y-auto lg:overscroll-contain"
      tabIndex={0}
    >
      <div className="px-6 pb-0 pt-5">
        <JobHeader job={job} headingLevel="h2" titleId="pane-title" titleClassName="md:text-display-sm" />
      </div>
      <div className="border-t border-divider px-6 py-5">
        <JobDescriptionInline sections={sections} />
      </div>
      <div className="border-t border-divider px-6 py-5">
        <ProgramPeople org={job.org} people={people} total={peopleTotal} proof={proof} as="section" />
      </div>
      <div className="border-t border-divider px-6 py-3">
        <TextLink href={`/jobs/${job.id}`} arrow className="target-24 text-small">
          Open the full job page
        </TextLink>
      </div>
    </Card>
  );
}
