import { Card } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/TextLink";
import type { JobDetail, ProgramNetwork } from "@/lib/queries/jobsx";
import { closeApplySections, jobSections } from "./description";
import type { JobProof } from "./JobCard";
import { JobDescriptionInline } from "./JobDescription";
import { JobHeader } from "./JobHeader";
import { JobNotes } from "./JobNotes";
import { isOpenJob } from "./labels";
import { ProgramPeople } from "./ProgramPeople";

type JobDetailPaneProps = {
  job: JobDetail;
  network: ProgramNetwork;
  proof: JobProof | null;
  /** The signed-in athletic director's own listing (owner view). */
  owner: boolean;
  /** Any athletic director: no Apply on other programs' listings. */
  employer?: boolean;
  /** The owner's hiring pipeline for this listing, when it has one. */
  pipelineListId?: number | null;
};

/**
 * The selected job on /jobs at lg and up (list left, job right). One card: header with its note
 * bands, description sections and the program's people, split by dividers; the pane scrolls on its
 * own and stays in view while the list scrolls.
 */
export function JobDetailPane({ job, network, proof, owner, employer, pipelineListId }: JobDetailPaneProps) {
  const parsed = jobSections(job.description);
  const sections = isOpenJob(job) ? parsed : closeApplySections(parsed, job.org.shortName);
  return (
    <Card
      as="section"
      aria-labelledby="pane-title"
      className="hidden lg:sticky lg:top-[calc(var(--nav-h)+20px)] lg:block lg:max-h-[calc(100dvh-var(--nav-h)-40px)] lg:overflow-y-auto lg:overscroll-contain"
      tabIndex={0}
    >
      <div className="px-6 pb-0 pt-5">
        {/* The owner's two buttons are wide for the pane, so they sit under the identity block. */}
        <JobHeader
          job={job}
          headingLevel="h2"
          titleId="pane-title"
          titleClassName="md:text-display-sm"
          owner={owner}
          employer={employer}
          pipelineListId={pipelineListId}
          stackActions={owner}
        />
      </div>
      <JobNotes job={job} owner={owner} inset="pane" />
      {sections.length > 0 && (
        <div className="border-t border-divider px-6 py-5">
          <JobDescriptionInline sections={sections} />
        </div>
      )}
      <div className="border-t border-divider px-6 py-5">
        <ProgramPeople org={job.org} network={network} proof={proof} as="section" />
      </div>
      <div className="border-t border-divider px-6 py-3">
        <TextLink href={`/jobs/${job.id}`} arrow target24 className="text-small">
          Open the full job page
        </TextLink>
      </div>
    </Card>
  );
}
