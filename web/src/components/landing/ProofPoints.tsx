import { Database, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import type { LandingStats } from "@/lib/queries/landing";
import { fmtCount } from "./copy";

/**
 * Proof points (§8.10): three StatBand columns of real dataset numbers at every width (values
 * text-stat tabular, phone stat-sm, over 13px --fg-2 labels), then a --surface-2 band saying where
 * the numbers come from: many records hold only the current job, tree connections are derived and
 * counted once per pair. Null stats render the inline error state in the same card.
 */
export function ProofPoints({ stats }: { stats: LandingStats | null }) {
  const items = stats
    ? [
        { value: stats.programs, label: "Division III programs" },
        { value: stats.coaches, label: "Coaches and staff" },
        { value: stats.connections, label: "Coaching-tree connections" },
      ]
    : [];
  return (
    <section aria-labelledby="proof-title">
      <h2 id="proof-title" className="sr-only">
        The dataset in numbers
      </h2>
      <Card className="overflow-hidden">
        {stats && stats.coaches === 0 ? (
          <EmptyState icon={Database} title="No coaches in the dataset yet." description="Counts appear here as staff pages are added." />
        ) : stats ? (
          <dl className="grid grid-cols-3">
            {items.map((item) => (
              // Phone: the first value keeps the card's 16px gutter; columns are 12px apart, so every
              // label fits in two lines down to 360px ("Coaching-tree / connections").
              <div
                key={item.label}
                className="flex min-w-0 flex-col-reverse justify-end py-4 pl-4 pr-2 md:px-6 md:py-5 [&+&]:border-l [&+&]:border-divider [&+&]:pl-3 md:[&+&]:pl-6"
              >
                <dt className="mt-0.5 text-small text-fg-2">{item.label}</dt>
                <dd className="num text-stat-sm md:text-stat">{fmtCount(item.value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="px-4 py-3 md:px-6">
            <ErrorState message="We couldn't load the dataset numbers." retryHref="/" />
          </div>
        )}
        <p role="note" className="flex items-start gap-2 border-t border-divider bg-surface-2 px-4 py-3 text-small text-fg-2 md:px-6">
          <Icon icon={Info} size={16} className="mt-px" />
          <span className="min-w-0 max-w-prose">
            {stats && stats.registryPrograms > 0
              ? `From public staff pages and coach bios at ${fmtCount(stats.programs)} of the ${fmtCount(stats.registryPrograms)} Division III football programs; many records list only the current job, and counts update as pages are added. `
              : "From public staff pages and coach bios; many records list only the current job, and counts update as pages are added. "}
            Tree connections are derived from overlapping seasons on the same staff, each pair counted once.{" "}
            <TextLink href="/about#data-sources" variant="inline">
              Data sources
            </TextLink>
          </span>
        </p>
      </Card>
    </section>
  );
}
