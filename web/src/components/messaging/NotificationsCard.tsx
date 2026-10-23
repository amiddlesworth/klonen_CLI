import type { ReactNode } from "react";
import { AtSign, Bell, Briefcase, Building2, Eye, Mail, MessageCircle, Network, type LucideIcon } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredFootnote, InferredYear } from "@/components/data/InferredYear";
import { SourceLink } from "@/components/data/SourceLink";
import { apTitle } from "@/components/feed/text";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CURRENT_SEASON } from "@/lib/brand";
import { timeAgo } from "@/lib/format";
import type { NotificationFilter, NotificationItem, NotificationMove } from "@/lib/queries/messaging";
import { inferredSeasonReason, joinAnd, threadHref } from "./format";
import { DayGroups, LocalTime } from "./LocalTime";
import { MarkAllReadButton } from "./MarkAllReadButton";
import { NotificationRow } from "./NotificationRow";

export const NOTIFICATION_FILTERS: { value: NotificationFilter; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/notifications" },
  { value: "moves", label: "Moves", href: "/notifications?filter=moves" },
  { value: "jobs", label: "Jobs", href: "/notifications?filter=jobs" },
  { value: "mentions", label: "Mentions", href: "/notifications?filter=mentions" },
];

type Empty = { icon: LucideIcon; title: string; description: string };
export type NotificationsRole = "coach" | "employer";

/** Empty states per filter, worded for the account: a coach has a tree and job matches, an AD has listings. */
const EMPTY: Record<NotificationsRole, Record<NotificationFilter, Empty>> = {
  coach: {
    all: { icon: Bell, title: "You're all caught up.", description: "Moves in your coaching tree, job matches and profile views will show up here." },
    moves: { icon: Network, title: "No moves from your network yet.", description: "When someone in your coaching tree changes jobs, it shows up here." },
    jobs: { icon: Briefcase, title: "No job notifications yet.", description: "Openings that match your position group show up here." },
    mentions: { icon: AtSign, title: "No mentions yet.", description: "When someone mentions you in a comment or a message, it shows up here." },
  },
  employer: {
    all: { icon: Bell, title: "You're all caught up.", description: "Applicants to your listings and moves by candidates in your pipeline will show up here." },
    moves: { icon: Network, title: "No moves from your pipeline yet.", description: "When a candidate in your hiring pipeline changes jobs, it shows up here." },
    jobs: { icon: Briefcase, title: "No listing activity yet.", description: "New applicants to your job listings show up here." },
    mentions: { icon: AtSign, title: "No mentions yet.", description: "When someone mentions you in a comment or a message, it shows up here." },
  },
};

/**
 * A 20px --fg-2 icon in a plain 40px box, for notifications about the viewer's own account (profile
 * views, a move with no named coach). No tile: rounded squares mean programs, circles mean people.
 */
function IconTile({ icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center text-fg-2">
      <Icon icon={icon} size={20} />
    </span>
  );
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const sentenceCase = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

/** The viewer's own program, from the session ("Pacific (OR) · your program"). */
export type ViewerOrg = { id: string; shortName: string };

type Described = {
  href: string | null;
  visual: ReactNode;
  sentence: ReactNode;
  /** A ContextLine under the sentence: why this move matters to the viewer. */
  context?: ReactNode;
  chips?: ReactNode;
  /**
   * A derived coaching move: dated by season ("2026 season") with its source, never by the
   * notification's timestamp. `inferred` holds the tooltip reason when the season isn't stated (§6.2).
   */
  season?: { sourceUrl: string | null; inferred: string | null };
  /**
   * How the row is dated when it is not a move (§6.3, rule 6): "season" for a job ("2026 season", as job
   * cards), "none" for an account notice with no event behind it (profile views). Relative time ("5h")
   * only for events people create with a real timestamp (messages, mentions).
   */
  when?: "season" | "none";
  /** For the demo footnote: what this row is when it is sample data ("profile views"); null for a sourced move. */
  sample: string | null;
};

/** Why a move in the viewer's tree matters to them: their own program, else how they worked together. */
function moveContext(m: NotificationMove, viewerOrg: ViewerOrg | null): ReactNode {
  if (viewerOrg && m.orgId === viewerOrg.id) {
    return <ContextLine icon={Building2}>{viewerOrg.shortName} · your program</ContextLine>;
  }
  const r = m.relation;
  if (!r) return null;
  const how =
    r.kind === "under_them" ? `You worked under ${m.personFirstName} at ${r.orgShortName}` : r.kind === "under_you" ? `Worked under you at ${r.orgShortName}` : `Worked alongside you at ${r.orgShortName}`;
  return <ContextLine icon={Network}>{how}</ContextLine>;
}

/** The row content for one stored notification. Only facts from its payload, the job it names or the move it resolves to. */
function describe(n: NotificationItem, profileSlug: string | null, viewerOrg: ViewerOrg | null): Described {
  const p = n.payload;
  switch (n.kind) {
    case "profile_view": {
      const count = typeof p.count === "number" && p.count > 0 ? p.count : null;
      return {
        href: profileSlug ? `/in/${profileSlug}` : null,
        visual: <IconTile icon={Eye} />,
        sentence: count ? (
          <>
            <strong className="num font-semibold">{count}</strong> new profile {count === 1 ? "view" : "views"} since your last visit.
          </>
        ) : (
          "Someone viewed your profile."
        ),
        when: "none",
        sample: "profile views",
      };
    }
    case "job_match":
    case "job": {
      const job = n.job;
      const title = job?.title ?? text(p.jobTitle);
      return {
        href: job ? `/jobs/${job.id}` : "/jobs",
        visual: job ? <OrgMark shortName={job.orgShortName} name={job.orgName} size={40} /> : <IconTile icon={Briefcase} />,
        sentence: job ? (
          <>
            A <strong className="font-semibold">{job.title}</strong> listing at <strong className="font-semibold">{job.orgName}</strong> matches your position group.
          </>
        ) : title ? (
          <>
            A new <strong className="font-semibold">{title}</strong> listing matches your position group.
          </>
        ) : (
          "A new job matches your position group."
        ),
        chips: job?.isSample ? <SampleChip label="Sample listing" /> : undefined,
        when: "season",
        sample: "job matches",
      };
    }
    case "tree":
    case "move": {
      const m = n.move;
      if (m) {
        // AP sentence (§6.3): lowercase title, the program's short name.
        return {
          href: `/in/${m.personSlug}`,
          visual: <Avatar name={m.personName} tintKey={m.personSlug} size={40} />,
          sentence:
            m.kind === "promoted" ? (
              <>
                <strong className="font-semibold">{m.personName}</strong> was promoted to {apTitle(m.role)} at <strong className="font-semibold">{m.orgShortName}</strong>.
              </>
            ) : (
              <>
                <strong className="font-semibold">{m.personName}</strong> joined <strong className="font-semibold">{m.orgShortName}</strong> as {apTitle(m.role)}.
              </>
            ),
          context: moveContext(m, viewerOrg),
          season: { sourceUrl: m.sourceUrl, inferred: m.yearsExplicit ? null : inferredSeasonReason(m.evidence, m.sourceUrl) },
          sample: null,
        };
      }
      // No move resolves (yet): the viewer's own tree, where moves show, rather than every move in D-III.
      return {
        href: profileSlug ? `/in/${profileSlug}/tree` : "/feed?filter=moves",
        visual: <IconTile icon={Network} />,
        sentence: sentenceCase(text(p.text) ?? "A coach from your coaching tree changed jobs"),
        season: { sourceUrl: null, inferred: null },
        sample: "coaching-tree notices",
      };
    }
    case "message": {
      const from = text(p.fromName);
      const thread = text(p.threadId);
      return {
        href: thread ? threadHref(thread) : "/messaging",
        visual: from ? <Avatar name={from} tintKey={text(p.fromSlug) ?? from} size={40} /> : <IconTile icon={Mail} />,
        sentence: from ? (
          <>
            <strong className="font-semibold">{from}</strong> sent you a message.
          </>
        ) : (
          "You have a new message."
        ),
        sample: "message alerts",
      };
    }
    case "mention": {
      const from = text(p.fromName);
      return {
        href: text(p.href),
        visual: from ? <Avatar name={from} tintKey={text(p.fromSlug) ?? from} size={40} /> : <IconTile icon={MessageCircle} />,
        sentence: from ? (
          <>
            <strong className="font-semibold">{from}</strong> mentioned you{text(p.text) ? `: “${text(p.text)}”` : "."}
          </>
        ) : (
          sentenceCase(text(p.text) ?? "You were mentioned")
        ),
        sample: "mentions",
      };
    }
    default:
      return { href: text(p.href), visual: <IconTile icon={Bell} />, sentence: sentenceCase(text(p.text) ?? "You have a new notification"), sample: "other notifications" };
  }
}

/**
 * The time line: "2026 season" (dotted when inferred) and the source for a move; the season for a job;
 * otherwise the relative time of a real event (messages, mentions).
 */
function TimeLine({ n, d, now }: { n: NotificationItem; d: Described; now: Date }) {
  if (d.when === "season") return <span className="num">{CURRENT_SEASON} season</span>;
  if (d.season) {
    return (
      <>
        <span className="num">
          {d.season.inferred ? <InferredYear reason={d.season.inferred}>{CURRENT_SEASON}</InferredYear> : CURRENT_SEASON} season
        </span>
        {d.season.sourceUrl && (
          <>
            <span aria-hidden="true">·</span>
            {/* Above the row's stretched link, so the source opens on its own. */}
            <SourceLink href={d.season.sourceUrl} className="relative z-10 min-h-6" />
          </>
        )}
      </>
    );
  }
  return (
    <LocalTime iso={n.createdAt.toISOString()} className="num">
      {timeAgo(n.createdAt, now)}
      <span className="sr-only"> ago</span>
    </LocalTime>
  );
}

/**
 * The demo footnote, worded from the rows shown: which kinds are sample data, and that sourced moves
 * come from public staff bios (they are real, so "sample data" must not cover them).
 */
function demoNote(rows: Described[]): string | null {
  if (!rows.length) return null;
  const samples = [...new Set(rows.map((d) => d.sample).filter((s): s is string => !!s))];
  const moves = rows.filter((d) => d.sample === null);
  const parts: string[] = [];
  if (samples.length) {
    const list = joinAnd(samples);
    // Every label is a plural noun ("profile views", "job matches").
    parts.push(`${list[0].toUpperCase()}${list.slice(1)} on this account are sample data.`);
  }
  if (moves.length) {
    parts.push(`Moves come from public staff bios${moves.every((d) => d.season?.sourceUrl) ? " and link to their source" : ""}.`);
  }
  return parts.join(" ");
}

type NotificationsCardProps = {
  items: NotificationItem[];
  filter: NotificationFilter;
  /** The account kind, for empty-state copy. */
  role: NotificationsRole;
  /** The viewer's profile (profile-view notifications link to it). */
  profileSlug: string | null;
  /** The viewer's own program (moves there say "your program"). */
  viewerOrg: ViewerOrg | null;
  /** Demo accounts get a footnote saying which notifications are sample data. */
  isDemo: boolean;
};

/**
 * Notifications (§8.16): one card with the h1, the unread count and "Mark all as read" (both scoped to
 * the filter), the filter (All · Moves · Jobs · Mentions), then rows grouped Today and Earlier in the
 * viewer's zone, and footnotes for inferred seasons and demo data.
 */
export function NotificationsCard({ items, filter, role, profileSlug, viewerOrg, isDemo }: NotificationsCardProps) {
  const now = new Date();
  const shown = filter === "all" ? items : items.filter((n) => n.category === filter);
  const unread = shown.filter((n) => !n.read).length;
  const rows = shown.map((n) => ({ n, d: describe(n, profileSlug, viewerOrg) }));
  const hasInferred = rows.some(({ d }) => d.season?.inferred);
  const note = isDemo ? demoNote(rows.map(({ d }) => d)) : null;
  const empty = EMPTY[role][filter];

  return (
    <Card>
      <div className="px-4 pt-4 md:px-6 md:pt-5">
        <PageHeader
          id="notifications-title"
          title="Notifications"
          headingProps={{ tabIndex: -1 }}
          meta={unread > 0 ? `${unread.toLocaleString("en-US")} new` : undefined}
          actions={unread > 0 ? <MarkAllReadButton filter={filter} /> : undefined}
          className="mb-3"
        />
        <SegmentedControl label="Filter notifications" value={filter} options={NOTIFICATION_FILTERS} />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          action={filter !== "all" && items.length > 0 ? <ButtonLink href="/notifications">Show all notifications</ButtonLink> : undefined}
          spacing="lg"
        />
      ) : (
        <div className="mt-1">
          <DayGroups
            now={now.toISOString()}
            rows={rows.map(({ n, d }) => ({
              id: n.id,
              at: n.createdAt.toISOString(),
              node: (
                <NotificationRow
                  id={n.id}
                  read={n.read}
                  href={d.href}
                  visual={d.visual}
                  sentence={d.sentence}
                  context={d.context}
                  chips={d.chips}
                  time={d.when === "none" ? null : <TimeLine n={n} d={d} now={now} />}
                />
              ),
            }))}
          />
        </div>
      )}

      {(hasInferred || note) && (
        <div className="space-y-2 border-t border-divider px-4 py-3 md:px-6">
          {hasInferred && <InferredFootnote />}
          {note && (
            <p className="text-caption text-fg-3">
              <SampleChip label="Demo" className="mr-1.5" />
              {note}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
