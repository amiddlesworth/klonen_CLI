import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextLink } from "@/components/ui/TextLink";
import type { JobDetail, ProgramNetwork } from "@/lib/queries/jobsx";
import { closeApplySections, jobSections, type DescriptionSection } from "./description";
import type { JobProof } from "./JobCard";
import { DescriptionBlocks } from "./JobDescription";
import { JobHeader } from "./JobHeader";
import { JobNotes } from "./JobNotes";
import { isOpenJob } from "./labels";
import { ProgramPeople } from "./ProgramPeople";

type JobDetailBodyProps = {
  job: JobDetail;
  network: ProgramNetwork;
  proof: JobProof | null;
  /** The signed-in athletic director's own listing (owner view). */
  owner: boolean;
  /** Any athletic director: no Apply on other programs' listings. */
  employer?: boolean;
  /** The owner's hiring pipeline for this listing, when it has one. */
  pipelineListId?: number | null;
  /**
   * "page": /jobs/[id], one card per part in the main column.
   * "pane": the selected job beside the /jobs list at lg, the same parts in one sticky card split by
   *   dividers, scrolling on its own while the list scrolls.
   */
  frame: "page" | "pane";
};

/** One description section's heading and blocks; a section with no blocks never reaches here. */
function SectionBody({ id, heading, blocks, as }: { id: string; heading: string; blocks: DescriptionSection["blocks"]; as: "h2" | "h3" }) {
  const H = as;
  return (
    <>
      {/* text-title, the card-title token, in both frames (audit X02). */}
      <H id={id} className="mb-3 text-title">
        {heading}
      </H>
      <DescriptionBlocks blocks={blocks} />
    </>
  );
}

function NoDescription({ shortName }: { shortName: string }) {
  return <EmptyState icon={FileText} title="No description yet." description={`${shortName} hasn't added details for this role.`} spacing="sm" />;
}

/**
 * The job detail (§8.9), used by both /jobs/[id] and the /jobs pane, so a job reads the same in
 * both (audit X02): the header (OrgMark 56, title text-display, program line, chips, Apply + Save
 * or the owner's hiring tools, facts, then the note bands), the description sections (About the
 * role, Responsibilities, Qualifications…, each titled with text-title), and the people from this
 * program on the network. A closed listing keeps its page: How to apply says it is closed.
 */
export function JobDetailBody({ job, network, proof, owner, employer, pipelineListId, frame }: JobDetailBodyProps) {
  const pane = frame === "pane";
  const parsed = jobSections(job.description);
  const sections = isOpenJob(job) ? parsed : closeApplySections(parsed, job.org.shortName);
  const prefix = pane ? "pane" : "job";
  const titleId = `${prefix}-title`;

  const header: ReactNode = (
    <>
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        {/* The pane's title is its region's h2 (the page has the "Jobs" h1); same size as the page's h1. */}
        <JobHeader
          job={job}
          headingLevel={pane ? "h2" : "h1"}
          titleId={titleId}
          owner={owner}
          employer={employer}
          pipelineListId={pipelineListId}
          // The owner's two buttons are wide for the pane, so they sit under the identity block there.
          stackActions={pane && owner}
        />
      </div>
      <JobNotes job={job} owner={owner} />
    </>
  );

  if (pane) {
    return (
      <Card
        as="section"
        aria-labelledby={titleId}
        className="hidden lg:sticky lg:top-[calc(var(--nav-h)+20px)] lg:block lg:max-h-[calc(100dvh-var(--nav-h)-40px)] lg:overflow-y-auto lg:overscroll-contain"
        tabIndex={0}
      >
        {header}
        {sections.length === 0 ? (
          <section aria-labelledby={`${prefix}-section-empty`} className="border-t border-divider px-6 py-5">
            <h3 id={`${prefix}-section-empty`} className="mb-3 text-title">
              About the role
            </h3>
            <NoDescription shortName={job.org.shortName} />
          </section>
        ) : (
          sections.map((s, i) => (
            <section key={i} aria-labelledby={`${prefix}-section-${i}`} className="border-t border-divider px-6 py-5">
              <SectionBody id={`${prefix}-section-${i}`} heading={s.heading ?? "About the role"} blocks={s.blocks} as="h3" />
            </section>
          ))
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

  return (
    <>
      <Card padding="none" aria-labelledby={titleId} className="overflow-hidden">
        {header}
      </Card>
      {sections.length === 0 ? (
        <Card padding="main" aria-labelledby={`${prefix}-section-empty`}>
          <CardHeader id={`${prefix}-section-empty`} title="About the role" />
          <NoDescription shortName={job.org.shortName} />
        </Card>
      ) : (
        sections.map((s, i) => (
          <Card key={i} padding="main" aria-labelledby={`${prefix}-section-${i}`}>
            <SectionBody id={`${prefix}-section-${i}`} heading={s.heading ?? "About the role"} blocks={s.blocks} as="h2" />
          </Card>
        ))
      )}
      <ProgramPeople org={job.org} network={network} proof={proof} />
    </>
  );
}
