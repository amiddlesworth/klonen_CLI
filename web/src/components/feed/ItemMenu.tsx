"use client";
import { Bookmark, BookmarkCheck, Ellipsis, ExternalLink, EyeOff, Flag, Link2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuItem, MenuLink } from "@/components/ui/MenuItems";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useFeedItem } from "./FeedArticle";
import { useSavedItem, type HideKind } from "./feedPrefs";
import { useCopyLink } from "./useCopyLink";

type ItemMenuProps = {
  /** Who or what the item is about ("Tanner Kingsley"), for the trigger's accessible name. */
  subject: string;
  /** Site path the "Copy link" item copies. */
  copyPath: string;
  sourceUrl?: string | null;
  /** Stable key of the item, for Save. */
  itemKey: string;
  /** What "Hide … like this" hides; milestones say "milestones", everything else "moves". */
  hideKind?: HideKind;
};

/**
 * More (ghost icon, 32; 44 on phone), §8.5: Save · Copy link · Hide moves like this · View source ·
 * Report an error. Save and hide are remembered in this browser (demo: nothing is sent).
 */
export function ItemMenu({ subject, copyPath, sourceUrl, itemKey, hideKind }: ItemMenuProps) {
  const item = useFeedItem();
  const copy = useCopyLink();
  const toast = useToast();
  const [saved, toggleSaved] = useSavedItem(itemKey);
  return (
    <Menu
      trigger={<Icon icon={Ellipsis} size={16} />}
      triggerLabel={`More options for ${subject}`}
      tooltip
      label={`Options for ${subject}`}
      triggerClassName={cn(buttonClasses({ variant: "ghost", iconOnly: true, phone: "large" }), "-mr-2 -mt-1.5 max-md:-mr-3.5 max-md:-mt-3")}
    >
      <MenuItem icon={saved ? BookmarkCheck : Bookmark} onClick={() => toast.show(toggleSaved() ? "Saved in this browser" : "Removed from saved items")}>
        {saved ? "Remove from saved" : "Save"}
      </MenuItem>
      <MenuItem icon={Link2} onClick={() => copy(copyPath, "Link copied")}>
        Copy link
      </MenuItem>
      {item && (
        <MenuItem icon={EyeOff} onClick={() => item.hide()}>
          Hide {hideKind === "milestone" ? "milestones" : "moves"} like this
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
