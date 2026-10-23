import type { ReactNode } from "react";
import { AtSign, Bell, Briefcase, Eye, Mail, MessageCircle, Network, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SampleChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { OrgMark } from "@/components/ui/OrgMark";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { timeAgo } from "@/lib/format";
import type { NotificationFilter, NotificationItem } from "@/lib/queries/messaging";
import { dayKey, fullDateTime, threadHref } from "./format";
import { MarkAllReadButton } from "./MarkAllReadButton";
import { NotificationRow } from "./NotificationRow";

export const NOTIFICATION_FILTERS: { value: NotificationFilter; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/notifications" },
  { value: "moves", label: "Moves", href: "/notifications?filter=moves" },
  { value: "jobs", label: "Jobs", href: "/notifications?filter=jobs" },
  { value: "mentions", label: "Mentions", href: "/notifications?filter=mentions" },
];

const EMPTY: Record<NotificationFilter, { icon: LucideIcon; title: string; description: string }> = {
  all: { icon: Bell, title: "You're all caught up.", description: "Moves in your coaching tree, job matches and profile views will show up here." },
  moves: { icon: Network, title: "No moves from your network yet.", description: "When someone in your coaching tree changes jobs, it shows up here." },
  jobs: { icon: Briefcase, title: "No job notifications yet.", description: "Openings that match your position group show up here." },
  mentions: { icon: AtSign, title: "No mentions yet.", description: "When someone mentions you in a comment or a message, it shows up here." },
};

/** A 40px rounded-square tile with an icon, for notifications about the viewer's own account. */
function IconTile({ icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-md bg-org-bg text-org-fg shadow-[inset_0_0_0_1px_var(--border)]">
      <Icon icon={icon} size={20} />
    </span>
  );
}

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const sentenceCase = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

type Described = { href: string | null; visual: ReactNode; sentence: ReactNode; chips?: ReactNode };

/** The row content for one stored notification. Only facts from its payload (and the job it names). */
function describe(n: NotificationItem, profileSlug: string | null): Described {
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
      };
    }
    case "tree":
    case "move":
      return {
        href: "/feed?filter=moves",
        visual: <IconTile icon={Network} />,
        sentence: sentenceCase(text(p.text) ?? "A coach from your coaching tree changed jobs"),
      };
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
      };
    }
    default:
      return { href: text(p.href), visual: <IconTile icon={Bell} />, sentence: sentenceCase(text(p.text) ?? "You have a new notification") };
  }
}

function Group({ id, label, items, profileSlug, now }: { id: string; label: string; items: NotificationItem[]; profileSlug: string | null; now: Date }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="px-4 pb-2 pt-4 text-small font-semibold text-fg-2 md:px-6">
        {label}
      </h2>
      <ul className="divide-y divide-divider border-t border-divider">
        {items.map((n) => {
          const d = describe(n, profileSlug);
          return (
            <NotificationRow
              key={n.id}
              id={n.id}
              read={n.read}
              href={d.href}
              visual={d.visual}
              sentence={d.sentence}
              chips={d.chips}
              time={
                <time dateTime={n.createdAt.toISOString()} title={fullDateTime(n.createdAt)} className="num">
                  {timeAgo(n.createdAt, now)}
                  <span className="sr-only"> ago</span>
                </time>
              }
            />
          );
        })}
      </ul>
    </section>
  );
}

type NotificationsCardProps = {
  items: NotificationItem[];
  filter: NotificationFilter;
  /** The viewer's profile (profile-view notifications link to it). */
  profileSlug: string | null;
  /** Demo accounts get a footnote saying their notifications are sample data. */
  isDemo: boolean;
};

/**
 * Notifications (§8.16): one card with the h1, the unread count and "Mark all as read", the filter
 * (All · Moves · Jobs · Mentions), then rows grouped Today and Earlier.
 */
export function NotificationsCard({ items, filter, profileSlug, isDemo }: NotificationsCardProps) {
  const now = new Date();
  const unread = items.filter((n) => !n.read).length;
  const shown = filter === "all" ? items : items.filter((n) => n.category === filter);
  const today = dayKey(now);
  const todays = shown.filter((n) => dayKey(n.createdAt) === today);
  const earlier = shown.filter((n) => dayKey(n.createdAt) !== today);
  const empty = EMPTY[filter];

  return (
    <Card>
      <div className="px-4 pt-4 md:px-6 md:pt-5">
        <div className="mb-3 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 id="notifications-title" tabIndex={-1} className="text-title">
            Notifications
          </h1>
          {unread > 0 && <span className="num text-small text-fg-3">{unread} new</span>}
          {unread > 0 && (
            <span className="ml-auto">
              <MarkAllReadButton />
            </span>
          )}
        </div>
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
          {todays.length > 0 && <Group id="notifications-today" label="Today" items={todays} profileSlug={profileSlug} now={now} />}
          {earlier.length > 0 && (
            <div className={todays.length ? "border-t border-divider" : undefined}>
              <Group id="notifications-earlier" label="Earlier" items={earlier} profileSlug={profileSlug} now={now} />
            </div>
          )}
        </div>
      )}

      {isDemo && items.length > 0 && (
        <p className="flex items-center gap-1.5 border-t border-divider px-4 py-3 text-caption text-fg-3 md:px-6">
          <SampleChip label="Demo" />
          These notifications belong to a demo account and are sample data.
        </p>
      )}
    </Card>
  );
}
