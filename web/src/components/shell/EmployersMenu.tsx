"use client";
import { Briefcase, LayoutGrid, Users } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { MenuLink } from "@/components/ui/MenuItems";
import { NAV_ITEM, NavIcon } from "./NavItem";
import type { Viewer } from "./types";

/** "For employers" entry: Post a job and Hiring pipeline. A nav item (icon over label), or a ghost button on the landing page (§8.10). */
export function EmployersMenu({ viewer, active, variant = "nav" }: { viewer: Viewer | null; active?: boolean; variant?: "nav" | "button" }) {
  const needsAd = viewer?.role !== "employer" ? "Uses the athletic director demo" : undefined;
  return (
    <Menu
      trigger={
        variant === "nav" ? (
          <>
            <NavIcon icon={LayoutGrid} />
            <span>For employers</span>
          </>
        ) : (
          "For employers"
        )
      }
      triggerClassName={variant === "nav" ? NAV_ITEM : buttonClasses({ variant: "ghost" })}
      triggerProps={{ "aria-current": active ? "page" : undefined }}
      label="For employers"
      placement="bottom-end"
      minWidth={240}
    >
      <MenuLink href="/employers/jobs/new" icon={Briefcase} description={needsAd ?? "Listed in the feed and on Jobs"}>
        Post a job
      </MenuLink>
      <MenuLink href="/employers/pipeline" icon={Users} description={needsAd ?? "Track candidates by stage"}>
        Hiring pipeline
      </MenuLink>
    </Menu>
  );
}
