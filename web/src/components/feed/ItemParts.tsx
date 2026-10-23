import type { ReactNode } from "react";
import { Building2, GraduationCap, Network, type LucideIcon } from "lucide-react";
import { SourceLink } from "@/components/data/SourceLink";
import { Icon } from "@/components/ui/Icon";
import { CURRENT_SEASON } from "@/lib/brand";
import { cn } from "@/lib/cn";
import type { FeedReason, ReasonKind } from "@/lib/queries/feedx";

/** A "·" separator in meta lines (hidden from screen readers). */
export function Sep() {
  return <span aria-hidden="true">·</span>;
}

const REASON_ICON: Record<ReasonKind, LucideIcon> = {
  program: Building2,
  headCoach: Network,
  colleague: Network,
  formerStaff: Building2,
  alum: GraduationCap,
  conference: Building2,
};

/**
 * Context strip (§8.3): band at the top of a feed card with the personal reason: the subject in
 * 600 --fg-1, then "·" and the reason ("Pacific (OR) · your program"). Only for personal reasons.
 */
export function ContextStrip({ reason }: { reason: FeedReason }) {
  return (
    <p className="flex items-center gap-1.5 border-b border-divider px-4 py-2 text-caption text-fg-2">
      <Icon icon={REASON_ICON[reason.kind]} size={12} className="text-fg-2" />
      <span className="sr-only">Why you&apos;re seeing this: </span>
      <b className="min-w-0 font-semibold text-fg-1">{reason.subject}</b>
      <Sep />
      <span className="min-w-0">{reason.text}</span>
    </p>
  );
}

type ItemHeaderProps = {
  /** Avatar 40 (person) or OrgMark 40 (program). */
  media: ReactNode;
  headingId: string;
  /** The AP-style sentence; links inside render 600. */
  headline: ReactNode;
  meta: ReactNode;
  /** The More menu. */
  menu?: ReactNode;
};

/** Feed item header grid `40 · 1fr · auto` (§8.5): media, headline <h2> + meta, More. */
export function ItemHeader({ media, headingId, headline, meta, menu }: ItemHeaderProps) {
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-x-3">
      {media}
      <div className="min-w-0">
        <h2 id={headingId} className="balance text-body font-normal [&_a]:font-semibold [&_a]:underline-offset-2 [&_a:hover]:underline [&_b]:font-semibold">
          {headline}
        </h2>
        {meta}
      </div>
      {menu ?? <span />}
    </div>
  );
}

type ItemMetaProps = {
  icon: LucideIcon;
  /** "New hire", "Promotion", "2 new hires". */
  kind: string;
  conferenceAbbr?: string | null;
  conference?: string | null;
  sourceUrl?: string | null;
  className?: string;
};

/** Meta line 12/16 --fg-3: kind label (--fg-2 500 + icon) · conference · "2026 season" · source domain. */
export function ItemMeta({ icon, kind, conferenceAbbr, conference, sourceUrl, className }: ItemMetaProps) {
  return (
    <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-fg-3", className)}>
      <span className="inline-flex items-center gap-1 font-medium text-fg-2">
        <Icon icon={icon} size={12} />
        {kind}
      </span>
      {conferenceAbbr && (
        <>
          <Sep />
          <abbr title={conference ?? conferenceAbbr}>{conferenceAbbr}</abbr>
        </>
      )}
      <Sep />
      <span className="num">{CURRENT_SEASON} season</span>
      {sourceUrl && (
        <>
          <Sep />
          <SourceLink href={sourceUrl} className="min-h-6" />
        </>
      )}
    </p>
  );
}
