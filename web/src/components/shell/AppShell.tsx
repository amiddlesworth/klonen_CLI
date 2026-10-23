import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { getDemoAccounts, getShellCounts } from "@/lib/queries/shell";
import { getSession } from "@/lib/session";
import { BottomTabBar } from "./BottomTabBar";
import { MeMenuSummaryProvider } from "./MeMenuSummary";
import { MobileTopBar } from "./MobileTopBar";
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
 * and, when signed in, the phone tab bar. Pages render their own layout (Layouts.tsx) inside.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession().catch(() => null);
  const [counts, accounts, viewer] = await Promise.all([
    session ? getShellCounts(session.user.id).catch(() => NO_COUNTS) : Promise.resolve(NO_COUNTS),
    getDemoAccounts().catch(() => FALLBACK_ACCOUNTS),
    session ? getViewer(session) : Promise.resolve(null),
  ]);

  return (
    <ToastProvider aboveTabBar={!!viewer}>
      <MeMenuSummaryProvider>
        <div className={cn("flex min-h-dvh flex-col", viewer && "has-tabbar")}>
          <TopNav viewer={viewer} counts={counts} accounts={accounts} />
          <MobileTopBar viewer={viewer} counts={counts} accounts={accounts} />
          <div className="flex flex-1 flex-col">{children}</div>
          {viewer && <BottomTabBar viewer={viewer} counts={counts} accounts={accounts} />}
        </div>
      </MeMenuSummaryProvider>
    </ToastProvider>
  );
}
