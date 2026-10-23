import Link from "next/link";
import { ChevronRight, Repeat } from "lucide-react";
import { StatGroup } from "@/components/data/StatGroup";
import { Card, CardFooter } from "@/components/ui/Card";
import { Chip, SampleChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { cn } from "@/lib/cn";
import type { CarouselTracker as Tracker, TrackerRow } from "@/lib/queries/feedx";

const MOVES_HREF = "/feed?filter=moves";
/** The Moves list narrowed to one KPI (§8.3: each KPI links to its filtered list). */
const kindHref = (kind: "hires" | "promotions" | "other") => `${MOVES_HREF}&kind=${kind}`;

function Row({ row, max, separate }: { row: TrackerRow; max: number; separate?: boolean }) {
  const pct = Math.round((row.hires / max) * 100);
  const cell = cn("py-[5px]", separate && "border-t border-divider pt-2");
  return (
    <tr className={cn(row.isViewer && "font-semibold")}>
      <th scope="row" className={cn(cell, "whitespace-nowrap text-left", row.isViewer ? "font-semibold" : "font-normal")}>
        <abbr title={row.name ?? row.conference}>{row.conference}</abbr>
        {row.isViewer && <span className="font-normal text-fg-3"> · yours</span>}
      </th>
      <td aria-hidden="true" className={cn(cell, "w-[38%] px-3")}>
        <div className="h-1.5 overflow-hidden rounded-[3px] bg-track">
          <i className={cn("block h-full rounded-[3px]", row.isViewer ? "bg-accent" : "bg-bar")} style={{ width: `${Math.max(pct, row.hires ? 4 : 0)}%` }} />
        </div>
      </td>
      <td className={cn(cell, "num w-10 text-right", row.isViewer ? "font-semibold" : "font-medium")}>{row.hires}</td>
      <td className={cn(cell, "num w-10 text-right", row.isViewer ? "font-semibold" : "font-medium")}>{row.promotions}</td>
    </tr>
  );
}

/**
 * Carousel tracker (§8.5): title + season chip; "Division III · N programs with staff data"; KPI
 * strip (Hires · Promotions · Open jobs with a Sample chip), each KPI linking to its filtered list,
 * and a caption for the role changes that count in neither; box score of the top five conferences by
 * hires plus the viewer's conference (bold, "· yours", Iris bar); footer "All moves →".
 *
 * On phone the rail sits below the feed, so the Moves filter also shows this card at the top of the
 * list (the "tracker view" the phone summary opens); `idPrefix` keeps the two copies' ids apart.
 */
export function CarouselTracker({ tracker, idPrefix = "", className }: { tracker: Tracker; idPrefix?: string; className?: string }) {
  const empty = tracker.hires + tracker.promotions === 0;
  const titleId = `${idPrefix}tracker-title`;
  return (
    <Card id={`${idPrefix}carousel-tracker`} padding="rail" aria-labelledby={titleId} className={cn("scroll-mt-16 md:scroll-mt-20", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={titleId} className="text-body font-semibold">
          Carousel tracker
        </h2>
        <Chip className="num">{String(tracker.season)}</Chip>
      </div>
      <p className="mt-0.5 text-caption text-fg-3">
        Division III · <span className="num">{tracker.programs}</span> programs with staff data
      </p>
      <StatGroup
        variant="kpi"
        label={`${tracker.season} carousel totals`}
        className="mt-3"
        stats={[
          { value: tracker.hires, label: "Hires", href: kindHref("hires") },
          { value: tracker.promotions, label: "Promotions", href: kindHref("promotions") },
          {
            value: tracker.openJobs,
            label: "Open jobs",
            href: "/jobs",
            adornment: tracker.sampleJobs > 0 ? <SampleChip label="Sample" className="h-[18px] px-1" /> : undefined,
          },
        ]}
      />
      {tracker.otherMoves > 0 && (
        // Every move is in the Moves list; these count in neither KPI, so the numbers add up (§11 rule 11).
        <p className="mt-2 text-caption text-fg-3">
          Plus{" "}
          <Link href={kindHref("other")} className="num font-medium text-link underline underline-offset-2">
            {tracker.otherMoves} other role {tracker.otherMoves === 1 ? "change" : "changes"}
          </Link>{" "}
          at the same program
        </p>
      )}
      {empty ? (
        <EmptyState icon={Repeat} title={`No moves recorded for ${tracker.season} yet.`} description="Hires and promotions show up as staff pages update." spacing="sm" align="start" />
      ) : (
        <table className="mt-3 w-full border-collapse text-small">
          <caption className="sr-only">
            {tracker.season} hires and promotions by conference: top five{tracker.viewerRow ? ", plus your conference" : ""}
          </caption>
          <thead>
            <tr className="text-caption text-fg-3">
              <th scope="col" className="border-b border-divider pb-1.5 text-left font-medium">
                Conference
              </th>
              <th aria-hidden="true" className="border-b border-divider" />
              <th scope="col" className="border-b border-divider pb-1.5 text-right font-medium">
                Hires
              </th>
              <th scope="col" className="border-b border-divider pb-1.5 text-right font-medium">
                <abbr title="Promotions">Prom.</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {tracker.rows.map((r) => (
              <Row key={r.conference} row={r} max={tracker.max} />
            ))}
            {tracker.viewerRow && <Row row={tracker.viewerRow} max={tracker.max} separate />}
          </tbody>
        </table>
      )}
      <CardFooter>
        <TextLink href={MOVES_HREF} arrow target24 className="text-small">
          All moves
        </TextLink>
      </CardFooter>
    </Card>
  );
}

/**
 * Phone only, first in the feed (§8.5 PhoneTrackerSummary): opens the tracker view, the Moves list
 * with the full tracker on top. The jobs number is the rail's Open jobs KPI; while every one is a
 * sample it reads "sample jobs", otherwise "open jobs" with the dashed Sample chip.
 */
export function PhoneTrackerSummary({ tracker }: { tracker: Tracker }) {
  const allSample = tracker.sampleJobs > 0 && tracker.sampleJobs === tracker.openJobs;
  return (
    <Link href={MOVES_HREF} className="flex min-h-16 items-center gap-3 border-y border-border bg-surface px-4 py-3 md:hidden">
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">Carousel tracker · {tracker.season}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-small text-fg-2">
          <span>
            <b className="num font-semibold text-fg-1">{tracker.hires}</b> hires
          </span>
          <span>
            <b className="num font-semibold text-fg-1">{tracker.promotions}</b> promotions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span>
              <b className="num font-semibold text-fg-1">{tracker.openJobs}</b> {allSample ? "sample jobs" : "open jobs"}
            </span>
            {!allSample && tracker.sampleJobs > 0 && <SampleChip label="Sample" className="h-[18px] px-1" />}
          </span>
        </span>
      </span>
      <Icon icon={ChevronRight} size={16} className="text-fg-3" />
    </Link>
  );
}
