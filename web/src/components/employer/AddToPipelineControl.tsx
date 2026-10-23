"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListPlus } from "lucide-react";
import { Button, ButtonLink, type ButtonPhone, type ButtonSize } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { addToPipeline } from "@/lib/actions/employer";
import { STAGE_LABEL, type PipelineStage } from "./stages";

export type AddToPipelineControlProps = {
  personId: string;
  /** The coach's name, for the accessible description and the toast. */
  name: string;
  /** Where the coach already is in the employer's pipeline, if anywhere… */
  initialStage?: PipelineStage | null;
  /** …and in which search, so "In pipeline" opens that search's board. */
  shortlistId?: number | null;
  size?: ButtonSize;
  phone?: ButtonPhone;
  fullWidth?: boolean;
  className?: string;
};

/** The board of one search, opened at a stage (the stage matters on phone, where one shows at a time). */
function boardHref(stage: PipelineStage, shortlistId: number | null): string {
  return shortlistId != null ? `/employers/pipeline?list=${shortlistId}&stage=${stage}` : `/employers/pipeline?stage=${stage}`;
}

/**
 * Client half of AddToPipelineButton. Not in the pipeline: secondary "Add to pipeline" that runs the
 * addToPipeline server action and confirms with a toast ("View pipeline" opens the board). Already
 * in it: a secondary link "In pipeline · {stage}" with a check, to that stage of that search.
 */
export function AddToPipelineControl({ personId, name, initialStage = null, shortlistId = null, size = "md", phone = "default", fullWidth, className }: AddToPipelineControlProps) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState<{ stage: PipelineStage; shortlistId: number | null } | null>(initialStage ? { stage: initialStage, shortlistId } : null);
  const [pending, startTransition] = useTransition();

  if (status) {
    const { stage } = status;
    return (
      <ButtonLink
        href={boardHref(stage, status.shortlistId)}
        icon={Check}
        size={size}
        phone={phone}
        fullWidth={fullWidth}
        aria-label={`In pipeline · ${STAGE_LABEL[stage]}: ${name}`}
        title="Open the hiring pipeline"
        className={className}
      >
        In pipeline · {STAGE_LABEL[stage]}
      </ButtonLink>
    );
  }

  return (
    <Button
      icon={ListPlus}
      size={size}
      phone={phone}
      fullWidth={fullWidth}
      loading={pending}
      aria-label={`Add to pipeline: ${name}`}
      className={className}
      onClick={() =>
        startTransition(async () => {
          try {
            const res = await addToPipeline(personId);
            if (!res.ok) return toast.show(res.error);
            setStatus({ stage: res.stage, shortlistId: res.shortlistId });
            toast.show(res.alreadyAdded ? `${name} is already in ${res.shortlistLabel}` : `Added ${name} to ${res.shortlistLabel} · ${STAGE_LABEL[res.stage]}`, {
              actionLabel: "View pipeline",
              onAction: () => router.push(boardHref(res.stage, res.shortlistId)),
            });
          } catch {
            toast.show(`${name} wasn't added. Try again.`);
          }
        })
      }
    >
      Add to pipeline
    </Button>
  );
}
