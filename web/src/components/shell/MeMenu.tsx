"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Briefcase, ChevronDown, Lock, LogOut, Settings, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Menu, MenuSurface } from "@/components/ui/Menu";
import { MenuDivider, MenuGroup, MenuHeader, MenuItem, MenuLink, MenuRadioItem } from "@/components/ui/MenuItems";
import type { Placement } from "@/components/ui/floating";
import { availabilityStatus } from "@/lib/format";
import { DemoAccountGroup, useDemoSwitch } from "./DemoSwitcher";
import { useMeMenuSummary } from "./MeMenuSummary";
import { NAV_ITEM, NavIcon, TAB_CELL } from "./NavItem";
import { applyThemePref, readThemePref, type ThemePref } from "./theme";
import type { DemoAccountOption, Viewer } from "./types";

type MeMenuProps = {
  viewer: Viewer;
  accounts: DemoAccountOption[];
  /** "nav": avatar 24 over "Me ▾"; "mobile": avatar 32 in a 44px target; "tab": tab-bar cell. */
  variant: "nav" | "mobile" | "tab";
  active?: boolean;
};

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type MeMenuItemsProps = {
  viewer: Viewer;
  accounts: DemoAccountOption[];
  /** Page-provided summary shown at 721–1080px only (the feed's left rail, §8.2). */
  summary?: ReactNode;
};

/**
 * The Me menu's items (§8.2): header row (avatar 40, name, View profile), an optional tablet
 * summary, the Demo account group (the one Demo chip), Settings, Open to opportunities with its
 * private status, the phone-only For employers links, Theme and Sign out.
 */
export function MeMenuItems({ viewer, accounts, summary }: MeMenuItemsProps) {
  const [theme, setTheme] = useState<ThemePref>("system");
  const { switchTo } = useDemoSwitch();
  useEffect(() => setTheme(readThemePref()), []);

  const sub = [viewer.title, viewer.orgShortName].filter(Boolean).join(" · ") || (viewer.role === "employer" ? "Athletic director" : null);
  const identity = (
    <span className="flex min-w-0 items-start gap-3">
      <Avatar name={viewer.name} tintKey={viewer.tintKey} size={40} />
      <span className="min-w-0">
        <span className="block truncate text-body font-semibold">{viewer.name}</span>
        {sub && <span className="block text-caption text-fg-2">{sub}</span>}
        {viewer.profileSlug && <span className="mt-0.5 block text-small font-medium text-link">View profile</span>}
      </span>
    </span>
  );

  return (
    <>
      {viewer.profileSlug ? (
        <MenuLink href={`/in/${viewer.profileSlug}`} className="items-start gap-3 py-2">
          {identity}
        </MenuLink>
      ) : (
        <MenuHeader>{identity}</MenuHeader>
      )}
      {summary && (
        <div role="none" className="hidden md:max-lg:block">
          <MenuDivider />
          {summary}
        </div>
      )}
      <MenuDivider />
      <DemoAccountGroup accounts={accounts} current={viewer.role} />
      <MenuDivider />
      <MenuLink href="/settings" icon={Settings}>
        Settings
      </MenuLink>
      {viewer.availability && (
        <MenuLink href="/settings/availability" icon={Lock} description={availabilityStatus(viewer.availability.open, viewer.availability.audience, viewer.orgShortName)}>
          Open to opportunities
        </MenuLink>
      )}
      <div role="none" className="md:hidden">
        <MenuLink href="/employers/jobs/new" icon={Briefcase}>
          Post a job
        </MenuLink>
        <MenuLink href="/employers/pipeline" icon={Users}>
          Hiring pipeline
        </MenuLink>
      </div>
      <MenuGroup label="Theme">
        {THEMES.map((t) => (
          <MenuRadioItem
            key={t.value}
            checked={theme === t.value}
            keepOpen
            onClick={() => {
              applyThemePref(t.value);
              setTheme(t.value);
            }}
          >
            {t.label}
          </MenuRadioItem>
        ))}
      </MenuGroup>
      <MenuDivider />
      <MenuItem icon={LogOut} onClick={() => switchTo("signed_out")}>
        Sign out
      </MenuItem>
    </>
  );
}

/** The Me menu panel rendered in place, for the component gallery (same items as the live menu). */
export function MeMenuPreview({ viewer, accounts }: { viewer: Viewer; accounts: DemoAccountOption[] }) {
  return (
    <MenuSurface label="Me (preview)" minWidth={288} className="w-[300px] max-w-full">
      <MeMenuItems viewer={viewer} accounts={accounts} />
    </MenuSurface>
  );
}

/**
 * Me menu (§8.2). Desktop and tablet: a dropdown under "Me ▾" (at 721–1080px it also carries the
 * page's MeMenuSummary, since the feed's left rail is hidden there). Phone (top-bar avatar and the
 * tab bar's Me cell): a bottom sheet with a drag handle, same items and keys.
 */
export function MeMenu({ viewer, accounts, variant, active }: MeMenuProps) {
  const summary = useMeMenuSummary();
  const placement: Placement = variant === "tab" ? "top-end" : variant === "mobile" ? "bottom-start" : "bottom-end";

  const trigger =
    variant === "nav" ? (
      <>
        <NavIcon>
          <Avatar name={viewer.name} tintKey={viewer.tintKey} size={24} />
        </NavIcon>
        <span className="inline-flex items-center gap-0.5">
          Me
          <Icon icon={ChevronDown} size={12} />
        </span>
      </>
    ) : variant === "mobile" ? (
      <Avatar name={viewer.name} tintKey={viewer.tintKey} size={32} />
    ) : (
      <>
        <span className="relative grid">
          <Avatar name={viewer.name} tintKey={viewer.tintKey} size={24} />
        </span>
        <span>Me</span>
      </>
    );

  const triggerClassName =
    variant === "nav"
      ? NAV_ITEM
      : variant === "mobile"
        ? "grid size-11 shrink-0 place-items-center rounded-sm"
        : TAB_CELL;

  return (
    <Menu
      trigger={trigger}
      triggerLabel="Me menu"
      triggerClassName={triggerClassName}
      triggerProps={{ "aria-current": active ? "page" : undefined }}
      label="Me"
      placement={placement}
      minWidth={288}
      panelClassName="w-[300px]"
      sheetOnPhone={variant !== "nav"}
    >
      <MeMenuItems viewer={viewer} accounts={accounts} summary={variant === "nav" ? summary : null} />
    </Menu>
  );
}
