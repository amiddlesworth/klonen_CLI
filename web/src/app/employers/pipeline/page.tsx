import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PipelineBoard } from "@/components/employer/PipelineBoard";
import { PipelineGate } from "@/components/employer/PipelineGate";
import { PipelineSkeleton } from "@/components/employer/PipelineSkeleton";
import { PIPELINE_STAGES, STAGE_LABEL } from "@/components/employer/stages";
import { PageContainer } from "@/components/shell/Layouts";
import { getEmployerShortlists, getPipeline } from "@/lib/queries/employer";
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

/**
 * /employers/pipeline (§8.14): the athletic director's shortlist by stage. The session and the
 * `?list=` ownership are checked before anything streams, so a bad or foreign list is a real 404;
 * the board then streams under a Suspense boundary with the skeleton (no route-level loading.tsx,
 * which would start the stream before notFound() could set the status).
 */
export default async function PipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await getSession();

  if (session?.user.kind !== "employer") {
    const accounts = await getDemoAccounts().catch(() => []);
    return (
      <PageContainer>
        <PipelineGate account={accounts.find((a) => a.role === "employer") ?? null} />
      </PageContainer>
    );
  }

  const listId = parseListId(first(sp.list));
  if (listId === null) notFound();
  if (listId !== undefined && !(await getEmployerShortlists(session.user.id)).some((l) => l.id === listId)) notFound();

  return (
    <PageContainer>
      <Suspense key={listId ?? "default"} fallback={<PipelineSkeleton />}>
        <PipelineBoard
          userId={session.user.id}
          orgId={session.user.orgId ?? session.org?.id ?? null}
          listId={listId}
          programName={session.org?.shortName ?? null}
        />
      </Suspense>
    </PageContainer>
  );
}
