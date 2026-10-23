import { Database, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { cn } from "@/lib/cn";
import type { LandingStats } from "@/lib/queries/landing";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Cell borders for a 2×2 grid on phone and one row of four from md: dividers between cells only. */
function cellBorders(i: number) {
  return cn("border-divider", i % 2 === 1 && "border-l", i >= 2 && "border-t md:border-t-0", i >= 1 && "md:border-l");
}

/**
 * Proof points (§8.10): a stat band of real dataset numbers (values text-display tabular over
 * 13px --fg-2 labels), then a --surface-2 band saying where the data comes from. Null stats render
 * the inline error state in the same card.
 */
export function ProofPoints({ stats }: { stats: LandingStats | null }) {
  const items = stats
    ? [
        { value: stats.programs, label: "Division III programs" },
        { value: stats.coaches, label: "Coaches" },
        { value: stats.stints, label: "Coaching stints" },
        { value: stats.edges, label: "Coaching-tree connections" },
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
          <dl className="grid grid-cols-2 md:grid-cols-4">
            {items.map((item, i) => (
              <div key={item.label} className={cn("flex flex-col-reverse justify-end px-4 py-4 md:px-6 md:py-5", cellBorders(i))}>
                <dt className="mt-0.5 text-small text-fg-2">{item.label}</dt>
                <dd className="num text-display-sm md:text-display">{fmt(item.value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="px-4 py-3 md:px-6">
            <ErrorState message="We couldn't load the dataset numbers." retryHref="/" />
          </div>
        )}
        <p className="flex items-start gap-2 border-t border-divider bg-surface-2 px-4 py-3 text-small text-fg-2 md:px-6">
          <Icon icon={Info} size={16} className="mt-px" />
          <span className="min-w-0">
            {stats && stats.registryPrograms > 0
              ? `Read from public athletics staff pages and coach bios at ${fmt(stats.programs)} of the ${fmt(stats.registryPrograms)} NCAA Division III football programs. `
              : "Read from public athletics staff pages and coach bios. "}
            Every stint links to the sentence it came from, and counts update as staff pages are added.{" "}
            <TextLink href="/about#data-sources" variant="inline">
              Data sources
            </TextLink>
          </span>
        </p>
      </Card>
    </section>
  );
}
