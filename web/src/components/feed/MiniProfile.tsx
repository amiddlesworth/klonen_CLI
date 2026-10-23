import Link from "next/link";
import { Bookmark, Briefcase, ChevronRight, Lock, Network, Users, type LucideIcon } from "lucide-react";
import { DemoFootnote } from "@/components/data/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Icon } from "@/components/ui/Icon";
import { MenuGroup, MenuLink } from "@/components/ui/MenuItems";
import { OrgMark } from "@/components/ui/OrgMark";
import type { FeedViewer, MiniProfileStats } from "@/lib/queries/feedx";

export type Shortcut = { href: string; label: string; icon: LucideIcon; count?: number };

/** Shortcuts for the viewer: coaches get their tree and saved jobs; athletic directors their hiring tools. */
export function shortcutsFor(viewer: FeedViewer, stats: MiniProfileStats | null): Shortcut[] {
  if (viewer.role === "employer") {
    return [
      { href: "/employers/pipeline", label: "Hiring pipeline", icon: Users },
      { href: "/employers/jobs/new", label: "Post a job", icon: Briefcase },
    ];
  }
  return [
    ...(viewer.slug ? [{ href: `/in/${viewer.slug}/tree`, label: "My coaching tree", icon: Network, count: stats?.treeSize }] : []),
    { href: "/jobs", label: "Saved jobs", icon: Bookmark },
  ];
}

function searchHref(name: string) {
  return `/search?q=${encodeURIComponent(name)}`;
}

type MiniProfileProps = {
  viewer: FeedViewer;
  stats: MiniProfileStats | null;
  /** availabilityStatus() line, coaches only. */
  status: string | null;
};

/**
 * Mini profile (§8.5, left rail at lg): avatar 48 above the name 15/600, title 13 --fg-2, program row
 * (OrgMark 24 + full program name); profile viewers and search appearances ("Past 7 days · demo
 * data"); the private Open to opportunities row linking to settings.
 */
export function MiniProfile({ viewer, stats, status }: MiniProfileProps) {
  const profileHref = viewer.slug ? `/in/${viewer.slug}` : null;
  const org = viewer.org;
  return (
    <Card padding="rail" aria-labelledby="mini-name">
      <Avatar name={viewer.name} tintKey={viewer.tintKey} size={48} />
      <p id="mini-name" className="mt-3 text-subtitle font-semibold leading-5">
        {profileHref ? (
          <Link href={profileHref} className="target-24 underline-offset-2 hover:underline">
            {viewer.name}
          </Link>
        ) : (
          viewer.name
        )}
      </p>
      {viewer.title && <p className="mt-0.5 text-small text-fg-2">{viewer.title}</p>}
      {org && (
        <p className="mt-2 flex items-center gap-2 text-caption text-fg-2">
          <OrgMark shortName={org.shortName} name={org.name} size={24} />
          {org.inRegistry ? (
            <Link href={`/programs/${org.slug}`} className="inline-flex min-h-6 min-w-0 items-center underline-offset-2 hover:text-fg-1 hover:underline">
              {org.name}
            </Link>
          ) : (
            <span className="min-w-0">{org.name}</span>
          )}
        </p>
      )}
      {stats && profileHref && (
        <>
          <Divider bleed="rail" className="my-3" />
          <ul>
            <li>
              <Link href={profileHref} className="flex items-baseline justify-between gap-2 text-small leading-6 text-fg-2 hover:text-fg-1">
                <span>Profile viewers</span>
                <b className="num font-semibold text-fg-1">{stats.profileViewers}</b>
              </Link>
            </li>
            <li>
              <Link href={searchHref(viewer.name)} className="flex items-baseline justify-between gap-2 text-small leading-6 text-fg-2 hover:text-fg-1">
                <span>Search appearances</span>
                <b className="num font-semibold text-fg-1">{stats.searchAppearances}</b>
              </Link>
            </li>
          </ul>
          <DemoFootnote className="mt-0.5">Past 7 days</DemoFootnote>
        </>
      )}
      {status && (
        <>
          <Divider bleed="rail" className="my-3" />
          <Link href="/settings/availability" className="group -mx-2 -my-1 flex items-center gap-2 rounded-sm px-2 py-1 transition-colors hover:bg-hover">
            <span className="min-w-0 flex-1">
              <span className="block text-small font-medium">Open to opportunities</span>
              <span className="flex items-center gap-1 text-caption text-fg-3">
                <Icon icon={Lock} size={12} className="text-fg-2" />
                {status}
              </span>
            </span>
            <Icon icon={ChevronRight} size={16} className="text-fg-3" />
          </Link>
        </>
      )}
    </Card>
  );
}

/** Shortcuts card (§8.5): 8px padding, 36px rows (icon 16, label 13 --fg-2, count 12 --fg-3). */
export function Shortcuts({ items }: { items: Shortcut[] }) {
  if (!items.length) return null;
  return (
    <Card as="nav" aria-label="Shortcuts" className="p-2">
      <ul>
        {items.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-9 items-center gap-2.5 rounded-sm px-2 text-small text-fg-2 transition-colors hover:bg-hover hover:text-fg-1">
              <Icon icon={s.icon} size={16} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.count !== undefined && <span className="num text-caption text-fg-3">{s.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The mini profile's key-values for the Me menu at 721–1080px, where the left rail is hidden (§8.2).
 * Rendered inside <MeMenuSummary>; every clickable row is a MenuLink.
 */
export function MeMenuStats({ viewer, stats, shortcuts }: { viewer: FeedViewer; stats: MiniProfileStats | null; shortcuts: Shortcut[] }) {
  const count = (n: number) => <span className="num text-small font-semibold text-fg-1">{n}</span>;
  return (
    <>
      {stats && viewer.slug && (
        <MenuGroup label="Past 7 days · demo data">
          <MenuLink href={`/in/${viewer.slug}`} trailing={count(stats.profileViewers)}>
            Profile viewers
          </MenuLink>
          <MenuLink href={searchHref(viewer.name)} trailing={count(stats.searchAppearances)}>
            Search appearances
          </MenuLink>
        </MenuGroup>
      )}
      {shortcuts.map((s) => (
        <MenuLink key={s.href} href={s.href} icon={s.icon} trailing={s.count !== undefined ? <span className="num text-caption text-fg-3">{s.count}</span> : undefined}>
          {s.label}
        </MenuLink>
      ))}
    </>
  );
}
