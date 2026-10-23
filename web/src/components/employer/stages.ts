/** Hiring pipeline stages (DESIGN.md §8.14), in board order. Plain module: safe in server and client code. */
export const PIPELINE_STAGES = ["sourced", "contacted", "interview", "offer"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  sourced: "Sourced",
  contacted: "Contacted",
  interview: "Interview",
  offer: "Offer",
};

export function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === "string" && (PIPELINE_STAGES as readonly string[]).includes(value);
}

/** The stage after this one, or null at Offer. */
export function nextStage(stage: PipelineStage): PipelineStage | null {
  const i = PIPELINE_STAGES.indexOf(stage);
  return PIPELINE_STAGES[i + 1] ?? null;
}

/** Longest note the pipeline stores. */
export const NOTE_MAX = 1000;
