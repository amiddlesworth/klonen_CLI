"use client";
import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { Briefcase, ChevronDown, Users } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { SampleChip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuDivider, MenuGroup, MenuLink, MenuRadioItem } from "@/components/ui/MenuItems";
import { useToast } from "@/components/ui/Toast";
import { switchDemoAccount } from "@/lib/actions/session";
import type { DemoRole } from "@/lib/session";
import type { DemoAccountOption } from "./types";

type Choice = DemoRole | "signed_out";

// The group already carries the one Demo chip, so the labels don't repeat "demo"; the
// description names the account ("Justin Leatherman · Pacific (OR)").
const ROLE_LABEL: Record<DemoRole, string> = { coach: "Coach", employer: "Athletic director" };

function describe(a: DemoAccountOption | undefined, role: DemoRole): string {
  if (!a) return role === "coach" ? "Follows moves and keeps a career record" : "Posts jobs and runs a hiring pipeline";
  return a.org ? `${a.name} · ${a.org}` : a.name;
}

/** Switches the demo account through the switchDemoAccount server action and confirms with a toast. */
export function useDemoSwitch() {
  const pathname = usePathname();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  /** `account` names the person in the toast ("Now viewing as Justin Leatherman"). */
  function switchTo(choice: Choice, account?: DemoAccountOption) {
    const who = account?.org ? account.name : choice === "signed_out" ? "" : `the ${ROLE_LABEL[choice].toLowerCase()} demo account`;
    toast.show(choice === "signed_out" ? "Signed out of the demo" : `Now viewing as ${who}`);
    startTransition(async () => {
      // Stay on the current page when switching accounts (pages that need a role explain it).
      await switchDemoAccount(choice, choice === "signed_out" ? "/" : pathname === "/" ? "/feed" : pathname);
    });
  }
  return { switchTo, pending };
}

/**
 * Demo account radio group (§8.2 Me menu): Coach, Athletic director, Signed out, each with the
 * account as its description. The group label carries the Demo chip: these are demo accounts, not
 * real sign-in. The coach's public record stays Unclaimed (ARCHITECTURE "Demo accounts").
 */
export function DemoAccountGroup({ accounts, current }: { accounts: DemoAccountOption[]; current: Choice }) {
  const { switchTo } = useDemoSwitch();
  const byRole = new Map(accounts.map((a) => [a.role, a]));
  return (
    <MenuGroup label="Demo account" adornment={<SampleChip label="Demo" />}>
      {(["coach", "employer"] as DemoRole[]).map((role) => (
        <MenuRadioItem key={role} checked={current === role} description={describe(byRole.get(role), role)} onClick={() => current !== role && switchTo(role, byRole.get(role))}>
          {ROLE_LABEL[role]}
        </MenuRadioItem>
      ))}
      <MenuRadioItem checked={current === "signed_out"} description="Browse public profiles as a visitor" onClick={() => current !== "signed_out" && switchTo("signed_out")}>
        Signed out
      </MenuRadioItem>
    </MenuGroup>
  );
}

/**
 * Signed-out "Sign in" control: a ghost button opening the demo account choices. On phone (the
 * compact top-bar version) it opens as a bottom sheet and also carries the For employers links,
 * since the phone top bar has no room for a second ghost control (§8.10).
 */
export function SignInMenu({ accounts, compact }: { accounts: DemoAccountOption[]; compact?: boolean }) {
  return (
    <Menu
      trigger={
        <>
          Sign in
          {!compact && <Icon icon={ChevronDown} size={14} />}
        </>
      }
      label="Sign in with a demo account"
      triggerClassName={buttonClasses({ variant: "ghost", phone: "default" })}
      placement="bottom-end"
      minWidth={280}
      sheetOnPhone={compact}
    >
      <p role="none" className="px-2 pb-1 pt-2 text-caption text-fg-3">
        Sign-in is a demo. Pick an account to explore as.
      </p>
      <DemoAccountGroup accounts={accounts} current="signed_out" />
      {compact && (
        <div role="none" className="md:hidden">
          <MenuDivider />
          <MenuGroup label="For employers">
            <MenuLink href="/employers/jobs/new" icon={Briefcase} description="Uses the athletic director demo">
              Post a job
            </MenuLink>
            <MenuLink href="/employers/pipeline" icon={Users} description="Uses the athletic director demo">
              Hiring pipeline
            </MenuLink>
          </MenuGroup>
        </div>
      )}
    </Menu>
  );
}
