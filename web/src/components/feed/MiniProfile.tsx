import Link from "next/link";
import { Building2, Briefcase, ChevronRight, Lock, Network, Users, type LucideIcon } from "lucide-react";
import { DemoFootnote, DemoLabel } from "@/components/data/Badges";
import { keepParen } from "@/components/data/TitleOrg";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Icon } from "@/components/ui/Icon";
import { MenuGroup, MenuLink } from "@/components/ui/MenuItems";
import { OrgMark } from "@/components/ui/OrgMark";
import type { FeedViewer, FollowedProgram, MiniProfileStats } from "@/lib/queries/feedx";
import { SavedJobsMenu, SavedJobsShortcut, type SavedJobRef } from "./SavedJobs";
import { ShortcutCount, ShortcutDisclosure, ShortcutItem, ShortcutLink } from "./ShortcutRows";

export type Shortcut =
  | { type: "link"; href: string; label: string; icon: LucideIcon; count?: number }
  /** Programs the viewer follows (Follow on a program page): they open in place. */
  | { type: "programs"; programs: FollowedProgram[] }
  /** Open jobs; the ones saved in this browser show, with their count. */
  | { type: "savedJobs"; jobs: SavedJobRef[] };

const PROGRAMS_LABEL = "Programs I follow";
/** Where to find programs to follow when there are none yet. */
const FIND_PROGRAMS = "/search?type=programs";

/**
 * Shortcuts (§8.5): coaches get My coaching tree, Programs I follow and Saved jobs, each with its
 * count; athletic directors their hiring tools and the programs they follow.
 */
export function shortcutsFor(viewer: FeedViewer, stats: MiniProfileStats | null, followed: FollowedProgram[], jobs: SavedJobRef[]): Shortcut[] {
  if (viewer.role === "employer") {
    return [
      { type: "link", href: "/employers/pipeline", label: "Hiring pipeline", icon: Users },
      { type: "link", href: "/employers/jobs/new", label: "Post a job", icon: Briefcase },
      { type: "programs", programs: followed },
    ];
  }
  return [
    ...(viewer.slug ? [{ type: "link" as const, href: `/in/${viewer.slug}/tree`, label: "My coaching tree", icon: Network, count: stats?.treeSize }] : []),
    { type: "programs", programs: followed },
    { type: "savedJobs", jobs },
  ];
}

const shortcutKey = (s: Shortcut) => (s.type === "link" ? s.href : s.type);

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
      <p id="mini-name" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-subtitle font-semibold leading-5">
        {profileHref ? (
          <Link href={profileHref} className="target-24 inline-block underline-offset-2 hover:underline">
            {viewer.name}
          </Link>
        ) : (
          <span>{viewer.name}</span>
        )}
        {/* A fictional demo account (the athletic director) is labeled where it appears (§6.4). */}
        {viewer.fictional && <DemoLabel />}
      </p>
      {viewer.title && <p className="mt-0.5 text-small text-fg-2">{viewer.title}</p>}
      {org && (
        <p className="mt-2 flex items-center gap-2 text-caption text-fg-2">
          <OrgMark shortName={org.shortName} name={org.name} size={24} />
          {org.inRegistry ? (
            <Link href={`/programs/${org.slug}`} className="inline-flex min-h-6 min-w-0 items-center underline-offset-2 hover:text-fg-1 hover:underline">
              {keepParen(org.name)}
            </Link>
          ) : (
            <span className="min-w-0">{keepParen(org.name)}</span>
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

/**
 * Shortcuts card (§8.5): 8px padding, 36px rows (icon 16, label 13 --fg-2, count 12 --fg-3).
 * Programs I follow and Saved jobs open in place to list their items; with none yet, they link to
 * where to find some.
 */
export function Shortcuts({ items }: { items: Shortcut[] }) {
  if (!items.length) return null;
  return (
    <Card as="nav" aria-label="Shortcuts" className="p-2">
      <ul>
        {items.map((s) => (
          <li key={shortcutKey(s)}>
            {s.type === "link" ? (
              <ShortcutLink href={s.href} icon={s.icon} label={s.label} count={s.count} />
            ) : s.type === "programs" ? (
              s.programs.length ? (
                <ShortcutDisclosure icon={Building2} label={PROGRAMS_LABEL} count={s.programs.length}>
                  {s.programs.map((p) => (
                    <ShortcutItem key={p.id} href={p.inRegistry ? `/programs/${p.slug}` : `/search?q=${encodeURIComponent(p.shortName)}`}>
                      {p.shortName}
                    </ShortcutItem>
                  ))}
                </ShortcutDisclosure>
              ) : (
                <ShortcutLink href={FIND_PROGRAMS} icon={Building2} label={PROGRAMS_LABEL} count={0} />
              )
            ) : (
              <SavedJobsShortcut jobs={s.jobs} />
            )}
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
      {shortcuts.map((s) =>
        s.type === "link" ? (
          <MenuLink key={shortcutKey(s)} href={s.href} icon={s.icon} trailing={s.count !== undefined ? <ShortcutCount n={s.count} /> : undefined}>
            {s.label}
          </MenuLink>
        ) : s.type === "programs" ? (
          s.programs.length ? (
            <MenuGroup key={shortcutKey(s)} label={`${PROGRAMS_LABEL} · ${s.programs.length}`}>
              {s.programs.map((p) => (
                <MenuLink key={p.id} href={p.inRegistry ? `/programs/${p.slug}` : `/search?q=${encodeURIComponent(p.shortName)}`}>
                  {p.shortName}
                </MenuLink>
              ))}
            </MenuGroup>
          ) : (
            <MenuLink key={shortcutKey(s)} href={FIND_PROGRAMS} icon={Building2} trailing={<ShortcutCount n={0} />}>
              {PROGRAMS_LABEL}
            </MenuLink>
          )
        ) : (
          <SavedJobsMenu key={shortcutKey(s)} jobs={s.jobs} />
        ),
      )}
    </>
  );
}
