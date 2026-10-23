"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, LayoutGrid } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { closeJob } from "@/lib/actions/jobs";
import { cn } from "@/lib/cn";

type OwnerActionsProps = {
  jobId: number;
  jobTitle: string;
  /** The listing is still open (Close listing is offered). */
  open: boolean;
  className?: string;
  /** Classes for each button (the header passes phone flex sizing). */
  buttonClassName?: string;
};

/**
 * The job header's actions for the athletic director who posted the listing (§8.13, §8.14): the
 * hiring pipeline as the one primary, and Close listing behind a confirmation (it can't be undone,
 * so Esc and the scrim don't dismiss it). Apply and Save never show on your own listing.
 */
export function OwnerActions({ jobId, jobTitle, open, className, buttonClassName }: OwnerActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function close() {
    setError(null);
    startTransition(async () => {
      const r = await closeJob(jobId).catch(() => ({ ok: false as const, error: "The listing couldn't be closed right now. Try again." }));
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setConfirming(false);
      toast.show(`Closed “${jobTitle}”. It's off Jobs and the feed.`);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <ButtonLink href="/employers/pipeline" variant="primary" icon={LayoutGrid} phone="large" className={buttonClassName}>
        Open hiring pipeline
      </ButtonLink>
      {/* A closed listing keeps only the pipeline here; "Post another job" sits in the note band below. */}
      {open && (
        <Button variant="secondary" phone="large" onClick={() => setConfirming(true)} aria-haspopup="dialog" className={buttonClassName}>
          Close listing
        </Button>
      )}
      <Dialog
        open={confirming}
        onOpenChange={(v) => {
          if (!pending) setConfirming(v);
        }}
        dismissible={false}
        title="Close this listing?"
        description={`“${jobTitle}” comes off Jobs and the feed right away, and coaches can't apply to it. Its page stays up, marked closed, so links keep working. This can't be undone in the demo.`}
        footer={(dismiss) => (
          <>
            <Button variant="secondary" onClick={dismiss} disabled={pending}>
              Keep it open
            </Button>
            <Button variant="danger" onClick={close} loading={pending}>
              Close listing
            </Button>
          </>
        )}
      >
        {error && (
          <p role="alert" className="flex items-start gap-2 text-small text-fg-1">
            <Icon icon={CircleAlert} size={16} className="mt-0.5 text-danger" />
            <span>{error}</span>
          </p>
        )}
      </Dialog>
    </div>
  );
}
