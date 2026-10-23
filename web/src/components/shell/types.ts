import type { AvailabilityAudience } from "@/lib/format";
import type { DemoRole } from "@/lib/session";

/** The signed-in demo account, as the shell needs it (serializable, safe to pass to client components). */
export type Viewer = {
  role: DemoRole;
  name: string;
  /** Avatar tint key: the person's slug, or the user id for accounts without a profile. */
  tintKey: string;
  /** Profile slug when the account is a coach with a profile. */
  profileSlug: string | null;
  title: string | null;
  orgShortName: string | null;
  orgSlug: string | null;
  /** Coach accounts: the private Open to opportunities setting (off when never set); null otherwise. */
  availability: { open: boolean; audience: AvailabilityAudience } | null;
};

export type ShellCounts = { unreadMessages: number; newNotifications: number };

/** A demo account offered by the switcher: its name, a one-line detail and its program's short name. */
export type DemoAccountOption = { role: DemoRole; name: string; detail: string | null; org: string | null };

export type NavSection = "home" | "network" | "jobs" | "messaging" | "notifications" | "me" | "employers" | "search" | "landing";

/**
 * Whether the phone tab bar is on this page: always when signed in; for visitors on every page but
 * the landing page, which keeps its clean top bar and no tab bar (§8.10).
 */
export function hasTabBar(pathname: string, signedIn: boolean): boolean {
  return signedIn || (pathname.replace(/\/+$/, "") || "/") !== "/";
}

/** Which primary nav item a path belongs to. */
export function navSectionFor(pathname: string, viewer: Viewer | null): NavSection | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return viewer ? null : "landing";
  if (p === "/feed") return "home";
  if (p.startsWith("/network")) return "network";
  if (p.startsWith("/jobs")) return "jobs";
  if (p.startsWith("/messaging")) return "messaging";
  if (p.startsWith("/notifications")) return "notifications";
  if (p.startsWith("/employers")) return "employers";
  if (p.startsWith("/search")) return "search";
  if (p.startsWith("/settings")) return "me";
  if (viewer?.profileSlug && (p === `/in/${viewer.profileSlug}` || p.startsWith(`/in/${viewer.profileSlug}/`))) return "me";
  return null;
}
