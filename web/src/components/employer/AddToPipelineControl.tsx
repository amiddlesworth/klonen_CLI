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
  /** Where the coach already is in the employer's pipeline, if anywhere. */
  initialStage?: PipelineStage | null;
  size?: ButtonSize;
  phone?: ButtonPhone;
  fullWidth?: boolean;
  className?: string;
};

/**
 * Client half of AddToPipelineButton. Not in the pipeline: secondary "Add to pipeline" that runs the
 * addToPipeline server action and confirms with a toast ("View pipeline" opens the board). Already
 * in it: a secondary link "In pipeline · {stage}" with a check, to that stage of the board.
 */
export function AddToPipelineControl({ personId, name, initialStage = null, size = "md", phone = "default", fullWidth, className }: AddToPipelineControlProps) {
  const router = useRouter();
  const toast = useToast();
  const [stage, setStage] = useState<PipelineStage | null>(initialStage);
  const [pending, startTransition] = useTransition();

  if (stage) {
    return (
      <ButtonLink
        href={`/employers/pipeline?stage=${stage}`}
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
            setStage(res.stage);
            toast.show(res.alreadyAdded ? `${name} is already in ${res.shortlistName}` : `Added ${name} to ${res.shortlistName} · ${STAGE_LABEL[res.stage]}`, {
              actionLabel: "View pipeline",
              onAction: () => router.push(`/employers/pipeline?stage=${res.stage}`),
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
