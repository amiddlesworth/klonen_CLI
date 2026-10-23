"use client";
import { ChevronDown } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuGroup, MenuRadioItem } from "@/components/ui/MenuItems";
import { cn } from "@/lib/cn";

/** "Showing Division III ▾" (§8.5 FeedToolbar, lg only). Division III is the only division with staff data so far. */
export function ScopeMenu() {
  return (
    <Menu
      trigger={
        <>
          Showing <b className="font-medium text-fg-1">Division III</b>
          <Icon icon={ChevronDown} size={14} />
        </>
      }
      triggerLabel="Showing Division III. Change division"
      label="Division"
      triggerClassName={cn(buttonClasses({ variant: "ghost" }), "hidden gap-1 pl-2.5 pr-2 font-normal lg:inline-flex")}
      focusChecked
      minWidth={240}
    >
      <MenuGroup label="Division">
        <MenuRadioItem checked>Division III</MenuRadioItem>
        <MenuRadioItem checked={false} disabled description="Added as staff pages are crawled">
          Division II
        </MenuRadioItem>
        <MenuRadioItem checked={false} disabled description="Added as staff pages are crawled">
          Division I
        </MenuRadioItem>
      </MenuGroup>
    </Menu>
  );
}
