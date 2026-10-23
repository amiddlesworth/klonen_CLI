import { Chip, SampleChip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { levelFull, levelShort } from "@/lib/format";

/** Division / level chip (§8.1 Neutral): "D-III", "High school", full name in title. */
export function LevelBadge({ level, className }: { level: string | null | undefined; className?: string }) {
  const short = levelShort(level);
  if (!short) return null;
  return (
    <Chip title={levelFull(level) ?? undefined} className={className}>
      {short}
    </Chip>
  );
}

/** Conference chip (§8.1 Abbreviation): "NWC" with the full name in title. */
export function ConferenceBadge({ abbr, name, className }: { abbr: string | null | undefined; name?: string | null; className?: string }) {
  if (!abbr) return null;
  return (
    <Chip kind="abbr" title={name ?? abbr} className={className}>
      {abbr}
    </Chip>
  );
}

/** Level and conference chips side by side, as next to every program name. */
export function ProgramBadges({
  level,
  conferenceAbbr,
  conference,
  className,
}: {
  level?: string | null;
  conferenceAbbr?: string | null;
  conference?: string | null;
  className?: string;
}) {
  if (!level && !conferenceAbbr) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <LevelBadge level={level} />
      <ConferenceBadge abbr={conferenceAbbr} name={conference} />
    </span>
  );
}

type DemoLabelProps = {
  /** "demo" → "Demo", "listing" → "Sample listing" (jobs), "sample" → "Sample" (aggregates). */
  kind?: "demo" | "listing" | "sample";
  className?: string;
};

/** Dashed chip on a demo or sample record (§6.4). Put it on the record itself. */
export function DemoLabel({ kind = "demo", className }: DemoLabelProps) {
  return <SampleChip label={kind === "listing" ? "Sample listing" : kind === "sample" ? "Sample" : "Demo"} className={className} />;
}

/** Footnote for aggregate demo numbers: "Past 7 days · demo data". */
export function DemoFootnote({ children, className }: { children?: string; className?: string }) {
  return <p className={cn("text-caption text-fg-3", className)}>{children ? `${children} · demo data` : "Demo data"}</p>;
}
