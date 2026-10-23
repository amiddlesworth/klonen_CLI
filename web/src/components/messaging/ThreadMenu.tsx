"use client";
import { useTransition } from "react";
import { Ellipsis, Mail, UserRound } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuItem, MenuLink } from "@/components/ui/MenuItems";
import { useToast } from "@/components/ui/Toast";
import { markThreadUnread } from "@/lib/actions/messaging";

/** More menu in the thread header: Mark as unread, View profile. Described by the header's name (#thread-title). */
export function ThreadMenu({ threadId, profileSlug }: { threadId: string; profileSlug: string | null }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  return (
    <Menu
      trigger={<Icon icon={Ellipsis} size={16} />}
      triggerLabel="More actions"
      triggerProps={{ "aria-describedby": "thread-title" }}
      tooltip
      triggerClassName={buttonClasses({ variant: "ghost", iconOnly: true })}
      label="Conversation actions"
      placement="bottom-end"
      sheetOnPhone
    >
      <MenuItem
        icon={Mail}
        onClick={() =>
          startTransition(async () => {
            const res = await markThreadUnread(threadId);
            toast.show(res.ok ? "Marked as unread" : "We couldn't mark this conversation as unread.");
          })
        }
      >
        Mark as unread
      </MenuItem>
      {profileSlug && (
        <MenuLink href={`/in/${profileSlug}`} icon={UserRound}>
          View profile
        </MenuLink>
      )}
    </Menu>
  );
}
