"use client";
import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { BRAND } from "@/lib/brand";

type ApplyButtonProps = {
  jobTitle: string;
  programName: string;
  /** Seeded sample listing (not posted by anyone). */
  sample: boolean;
  /** Phone sizing: 44px header actions. */
  large?: boolean;
  /** Preview only: a disabled-looking button that does nothing (the post-job preview). */
  preview?: boolean;
  className?: string;
};

/**
 * Apply (§8.9): the one primary action on a job. Applications are disabled in the demo, so it
 * opens a dialog that says so plainly instead of collecting anything.
 */
export function ApplyButton({ jobTitle, programName, sample, large, preview, className }: ApplyButtonProps) {
  const [open, setOpen] = useState(false);
  if (preview) {
    return (
      <Button variant="primary" aria-disabled="true" tabIndex={-1} phone={large ? "large" : "default"} className={className}>
        Apply
      </Button>
    );
  }
  return (
    <>
      <Button variant="primary" phone={large ? "large" : "default"} onClick={() => setOpen(true)} className={className} aria-haspopup="dialog">
        Apply
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Applications are disabled in the demo"
        description={
          sample
            ? `This is a sample listing. Applications open when ${programName} posts on ${BRAND.name}.`
            : `${programName} posted this listing from the demo account, so nothing is sent.`
        }
        footer={(close) => (
          <Button variant="primary" onClick={close}>
            Got it
          </Button>
        )}
      >
        <div className="flex items-start gap-2 rounded-sm bg-surface-2 px-3 py-2.5 text-small text-fg-2">
          <Icon icon={Info} size={16} className="mt-0.5 text-fg-2" />
          <p className="min-w-0">
            No application for <span className="font-medium text-fg-1">{jobTitle}</span> was created and nothing was shared with {programName}.
          </p>
        </div>
      </Dialog>
    </>
  );
}
