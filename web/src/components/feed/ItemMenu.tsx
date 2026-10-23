"use client";
import { Ellipsis, ExternalLink, EyeOff, Flag, Link2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuItem, MenuLink } from "@/components/ui/MenuItems";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useFeedItem } from "./FeedArticle";
import { useCopyLink } from "./useCopyLink";

type ItemMenuProps = {
  /** Who or what the item is about ("Tanner Kingsley"), for the trigger's accessible name. */
  subject: string;
  /** Site path the "Copy link" item copies. */
  copyPath: string;
  sourceUrl?: string | null;
  /** "move" or "update". */
  noun?: string;
};

/** More (ghost icon, 32; 44 on phone): Copy link · Hide this move · View source · Report an error (§8.5). */
export function ItemMenu({ subject, copyPath, sourceUrl, noun = "move" }: ItemMenuProps) {
  const item = useFeedItem();
  const copy = useCopyLink();
  const toast = useToast();
  return (
    <Menu
      trigger={<Icon icon={Ellipsis} size={16} />}
      triggerLabel={`More options for ${subject}`}
      tooltip
      label={`Options for ${subject}`}
      triggerClassName={cn(buttonClasses({ variant: "ghost", iconOnly: true, phone: "large" }), "-mr-2 -mt-1.5 max-md:-mr-3.5 max-md:-mt-3")}
    >
      <MenuItem icon={Link2} onClick={() => copy(copyPath, "Link copied")}>
        Copy link
      </MenuItem>
      {item && (
        <MenuItem icon={EyeOff} onClick={() => item.hide()}>
          Hide this {noun}
        </MenuItem>
      )}
      {sourceUrl && (
        <MenuLink href={sourceUrl} target="_blank" rel="noopener noreferrer" icon={ExternalLink}>
          View source
          <span className="sr-only"> (opens in a new tab)</span>
        </MenuLink>
      )}
      <MenuItem icon={Flag} onClick={() => toast.show("Thanks. Reports aren't sent anywhere in this demo yet.")}>
        Report an error
      </MenuItem>
    </Menu>
  );
}
