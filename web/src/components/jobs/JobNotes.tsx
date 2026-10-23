import type { ReactNode } from "react";
import { Info, Lock } from "lucide-react";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { isOpenJob } from "./labels";

type JobNotesProps = {
  job: { source: string; isDemo: boolean; status: string; org: { shortName: string } };
  /** The signed-in athletic director posted this listing (or it is their program's). */
  owner: boolean;
};

/** A band spans the header card: 16px sides on phone, 24px from md (the job page and the /jobs pane alike). */
function Band({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div role="note" className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-divider bg-surface-2 px-4 py-3 text-small text-fg-2 md:px-6">
      <p className="flex min-w-0 flex-1 basis-64 items-start gap-2">
        {icon}
        <span className="min-w-0">{children}</span>
      </p>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Full-width --surface-2 bands at the bottom of the job header card (§5.3 "1-band"): whether the
 * listing still takes applications, then whose listing it is. A seeded sample says so here, next to
 * the header's dashed chip, rather than as a stray line inside the description. The owner sees one
 * band, "Your listing" with the Demo chip (the owner view is labeled Demo), which also says when it
 * is closed, and a link to post another.
 */
export function JobNotes({ job, owner }: JobNotesProps) {
  const closed = !isOpenJob(job);
  const info = <Icon icon={Info} size={16} className="mt-0.5 text-fg-2" />;
  return (
    <>
      {closed && !owner && (
        <Band icon={<Icon icon={Lock} size={16} className="mt-0.5 text-fg-2" />}>
          <span className="font-medium text-fg-1">This listing is closed.</span> {job.org.shortName} is no longer taking applications. The page stays up so links to it keep
          working.
        </Band>
      )}
      {owner ? (
        <Band
          icon={<Icon icon={Lock} size={16} className="mt-0.5 text-fg-2" />}
          action={
            <TextLink href="/employers/jobs/new" arrow target24 className="text-small">
              Post another job
            </TextLink>
          }
        >
          <SampleChip label="Demo" className="mr-2" />
          {closed ? (
            <>
              <span className="font-medium text-fg-1">Your listing is closed.</span> Coaches can&apos;t apply. The page stays up so links to it keep working.
            </>
          ) : (
            <>
              <span className="font-medium text-fg-1">Your listing.</span> Coaches see Apply and Save here; you see your hiring tools.
            </>
          )}
        </Band>
      ) : job.source === "sample" ? (
        <Band icon={info}>
          This is a sample listing created for the demo. It is not a real opening.
        </Band>
      ) : job.isDemo ? (
        <Band icon={info}>
          Posted from the {job.org.shortName} athletic director demo account. It is not a real opening.
        </Band>
      ) : null}
    </>
  );
}
