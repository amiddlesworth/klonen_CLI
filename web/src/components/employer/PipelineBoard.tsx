import { countPeopleSearches, getEmployerProgram, getPipeline } from "@/lib/queries/employer";
import { findCandidatesSpecs, pipelinePresetSpecs } from "./presets";
import { PipelineView } from "./PipelineView";

type PipelineBoardProps = {
  userId: string;
  /** The employer's program (its division, conference and head coach drive the searches). */
  orgId: string | null;
  /** `?list=`, already checked as the employer's; undefined = the first search. */
  listId: number | undefined;
  /** Session copy of the program name, when it has one. */
  programName: string | null;
};

/**
 * Loads one search's board (server component; streams under the page's Suspense) and the searches
 * it links to. Every search link is counted with the search feature's own query first: "Find
 * candidates" takes the first target that returns anyone, and quick searches that would come back
 * empty are dropped.
 */
export async function PipelineBoard({ userId, orgId, listId, programName }: PipelineBoardProps) {
  const [data, program] = await Promise.all([getPipeline(userId, listId), getEmployerProgram(orgId)]);
  const name = data.shortlist?.name ?? null;
  const find = findCandidatesSpecs(name, program);
  const quick = pipelinePresetSpecs(name, program);
  const counts = await countPeopleSearches([...find, ...quick].map((s) => s.criteria));
  const findHref = find.find((_, i) => counts[i] > 0)?.href ?? "/search";
  const presets = quick.filter((s, i) => counts[find.length + i] > 0 && s.href !== findHref).map(({ label, href }) => ({ label, href }));

  return (
    <PipelineView
      shortlist={data.shortlist}
      shortlists={data.shortlists}
      programName={programName ?? program?.shortName ?? null}
      candidates={data.candidates}
      findHref={findHref}
      presets={presets}
    />
  );
}
