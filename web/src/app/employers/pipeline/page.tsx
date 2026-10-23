import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolderSearch } from "lucide-react";
import { PipelineGate } from "@/components/employer/PipelineGate";
import { PipelineView } from "@/components/employer/PipelineView";
import { findCandidatesHref, pipelinePresets } from "@/components/employer/presets";
import { isPipelineStage, PIPELINE_STAGES, STAGE_LABEL } from "@/components/employer/stages";
import { PageContainer } from "@/components/shell/Layouts";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getEmployerProgram, getPipeline } from "@/lib/queries/employer";
import { getDemoAccounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";

type SearchParams = Promise<{ list?: string | string[]; stage?: string | string[] }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `?list=` must be a positive integer; anything else is "not found". undefined = default search. */
function parseListId(raw: string | undefined): number | null | undefined {
  if (raw === undefined) return undefined;
  return /^\d{1,9}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

const PRIVATE = { robots: { index: false, follow: false } } satisfies Metadata;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const session = await getSession().catch(() => null);
  if (session?.user.kind !== "employer") return { title: "Hiring pipeline", ...PRIVATE };
  const listId = parseListId(first((await searchParams).list));
  if (listId === null) return { title: "Search not found", ...PRIVATE };
  const data = await getPipeline(session.user.id, listId);
  if (!data.shortlist) return { title: listId === undefined ? "Hiring pipeline" : "Search not found", ...PRIVATE };
  const counts = PIPELINE_STAGES.map((s) => `${data.candidates.filter((c) => c.stage === s).length} ${STAGE_LABEL[s].toLowerCase()}`).join(", ");
  return {
    title: `${data.shortlist.name} · Hiring pipeline`,
    description: `${data.candidates.length} candidates by stage: ${counts}.`,
    ...PRIVATE,
  };
}

/** /employers/pipeline (§8.14): the athletic director's shortlist by stage. */
export default async function PipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await getSession();

  if (session?.user.kind !== "employer") {
    const accounts = await getDemoAccounts().catch(() => []);
    return (
      <PageContainer>
        <PipelineGate viewerName={session?.user.name ?? null} account={accounts.find((a) => a.role === "employer") ?? null} />
      </PageContainer>
    );
  }

  const listId = parseListId(first(sp.list));
  if (listId === null) notFound();
  const [data, program] = await Promise.all([getPipeline(session.user.id, listId), getEmployerProgram(session.user.orgId ?? session.org?.id)]);
  if (listId !== undefined && !data.shortlist) notFound();

  if (!data.shortlist) {
    return (
      <PageContainer>
        <Card padding="main" aria-labelledby="pipeline-title">
          <CardHeader as="h1" id="pipeline-title" title="Hiring pipeline" />
          <EmptyState
            as="h2"
            icon={FolderSearch}
            title="No hiring searches yet."
            description="Add a coach from search results or a profile and a shortlist starts here, in Sourced."
            action={
              <ButtonLink href={findCandidatesHref(null, program)} variant="primary" phone="large">
                Find candidates
              </ButtonLink>
            }
            spacing="lg"
          />
        </Card>
      </PageContainer>
    );
  }

  const stageParam = first(sp.stage);
  return (
    <PageContainer>
      <PipelineView
        shortlist={data.shortlist}
        shortlists={data.shortlists}
        programName={session.org?.shortName ?? program?.shortName ?? null}
        candidates={data.candidates}
        initialStage={isPipelineStage(stageParam) ? stageParam : "sourced"}
        findHref={findCandidatesHref(data.shortlist.name, program)}
        presets={pipelinePresets(data.shortlist.name, program)}
        isDemo={session.user.isDemo}
      />
    </PageContainer>
  );
}
