"use client";
import { Ellipsis, Info, Link2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuItem, MenuLink } from "@/components/ui/MenuItems";
import { useToast } from "@/components/ui/Toast";

/** More (icon, menu): Copy link · How this page is built. */
export function ProgramMoreMenu({ path, name }: { path: string; name: string }) {
  const toast = useToast();

  async function copyLink() {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Link copied");
    } catch {
      toast.show("Couldn't copy the link. Copy it from the address bar.");
    }
  }

  return (
    <Menu
      trigger={<Icon icon={Ellipsis} size={16} />}
      triggerLabel="More actions"
      label={`More actions for ${name}`}
      tooltip
      triggerClassName={buttonClasses({ variant: "secondary", iconOnly: true, phone: "large" })}
      sheetOnPhone
    >
      <MenuItem icon={Link2} onClick={copyLink}>
        Copy link to this page
      </MenuItem>
      <MenuLink icon={Info} href="/about#data-sources" description="Staff pages and coach bios, read and quoted">
        How this page is built
      </MenuLink>
    </Menu>
  );
}
