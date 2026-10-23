"use client";
import { useTransition } from "react";
import { Ellipsis, Mail, UserRound } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuItem, MenuLink } from "@/components/ui/MenuItems";
import { useToast } from "@/components/ui/Toast";
import { markThreadUnread } from "@/lib/actions/messaging";

const FAILED = "We couldn't mark this conversation as unread.";

/**
 * More menu in the thread header: Mark as unread (when there is a conversation), View profile.
 * Described by the header's name (#thread-title). A failed request (offline) shows a toast.
 */
export function ThreadMenu({ threadId, profileSlug }: { threadId: string | null; profileSlug: string | null }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  if (!threadId && !profileSlug) return null;
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
      {threadId && (
        <MenuItem
          icon={Mail}
          onClick={() =>
            startTransition(async () => {
              try {
                const res = await markThreadUnread(threadId);
                toast.show(res.ok ? "Marked as unread" : FAILED);
              } catch {
                toast.show(FAILED);
              }
            })
          }
        >
          Mark as unread
        </MenuItem>
      )}
      {profileSlug && (
        <MenuLink href={`/in/${profileSlug}`} icon={UserRound}>
          View profile
        </MenuLink>
      )}
    </Menu>
  );
}
