import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { readNotificationsSeenAt } from "@/lib/notifications-seen";
import { getDemoAccounts, getShellCounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";
import { BottomTabBar } from "./BottomTabBar";
import { MeMenuSummaryProvider } from "./MeMenuSummary";
import { MobileTopBar } from "./MobileTopBar";
import { ShellFrame } from "./ShellFrame";
import { TopNav } from "./TopNav";
import type { DemoAccountOption, ShellCounts } from "./types";
import { getViewer } from "./viewer";

const NO_COUNTS: ShellCounts = { unreadMessages: 0, newNotifications: 0 };
const FALLBACK_ACCOUNTS: DemoAccountOption[] = [
  { role: "coach", name: "Coach", detail: null, org: null },
  { role: "employer", name: "Athletic director", detail: null, org: null },
];

/**
 * App shell (§8.2): reads the demo session, then renders the top nav (md and up), the phone top bar
 * and the phone tab bar (signed in, or a visitor on any page but the landing page). Pages render
 * their own layout (Layouts.tsx) inside.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession().catch(() => null);
  const seenAt = session ? await readNotificationsSeenAt() : null;
  const [counts, accounts, viewer] = await Promise.all([
    session ? getShellCounts(session.user.id, seenAt).catch(() => NO_COUNTS) : Promise.resolve(NO_COUNTS),
    getDemoAccounts().catch(() => FALLBACK_ACCOUNTS),
    session ? getViewer(session) : Promise.resolve(null),
  ]);

  return (
    <ToastProvider>
      <MeMenuSummaryProvider>
        <ShellFrame signedIn={!!viewer}>
          <TopNav viewer={viewer} counts={counts} accounts={accounts} />
          <MobileTopBar viewer={viewer} counts={counts} accounts={accounts} />
          <div className="flex flex-1 flex-col">{children}</div>
          <BottomTabBar viewer={viewer} counts={counts} accounts={accounts} />
        </ShellFrame>
      </MeMenuSummaryProvider>
    </ToastProvider>
  );
}
