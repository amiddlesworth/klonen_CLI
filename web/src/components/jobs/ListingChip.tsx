import { Chip } from "@/components/ui/Chip";
import { LISTING_LABEL, listingKind } from "./labels";

const TITLE = {
  sample: "A sample job created for the demo, not a real opening.",
  demo: "Posted from the athletic director demo account, not a real opening.",
} as const;

/**
 * The dashed chip on a job record that is not a real opening (§6.4, §8.1 Sample chip): "Sample
 * listing" for seeded samples, "Demo listing" for listings posted from the demo accounts. Nothing
 * for a real listing. Every place a job renders uses this, so the words never drift.
 */
export function ListingChip({ job, className }: { job: { isDemo: boolean; source: string }; className?: string }) {
  const kind = listingKind(job);
  if (!kind) return null;
  return (
    <Chip kind="sample" title={TITLE[kind]} className={className}>
      {LISTING_LABEL[kind]}
    </Chip>
  );
}
