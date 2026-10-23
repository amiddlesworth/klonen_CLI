"use client";
import Link from "next/link";
import { useId, useTransition, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Ellipsis, Settings } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { MenuItem, MenuLink } from "@/components/ui/MenuItems";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { setNotificationRead } from "@/lib/actions/messaging";

type NotificationRowProps = {
  id: number;
  read: boolean;
  /** Where the notification leads; clicking anywhere on the row goes there and marks it read. */
  href: string | null;
  /** Avatar 40 or tile 40. */
  visual: ReactNode;
  /** One sentence, names 600. */
  sentence: ReactNode;
  /** Chips on the time line (Sample listing). */
  chips?: ReactNode;
  /** The time line ("5h", "2026 season"). */
  time: ReactNode;
};

const STRETCH =
  "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus focus-visible:after:outline-solid";

/**
 * Notification row (§8.16): 16px padding, avatar or tile 40, one sentence 13/20, the time 12 --fg-3
 * and More. Unread rows sit on --surface-2 with an 8px ink dot on the left edge (and say "Unread" to
 * screen readers). The whole row is one link; following it marks the notification read.
 */
export function NotificationRow({ id, read, href, visual, sentence, chips, time }: NotificationRowProps) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const sentenceId = useId();
  const router = useRouter();

  const setRead = (value: boolean, announce: boolean) =>
    startTransition(async () => {
      const res = await setNotificationRead(id, value);
      if (announce) toast.show(res.ok ? (value ? "Marked as read" : "Marked as unread") : "We couldn't update this notification.");
    });

  // Mark read, then navigate: a revalidating action that lands mid-navigation would refresh this page
  // instead. Opening in a new tab (modifier keys) leaves this page here, so it just marks it read.
  function follow(e: MouseEvent<HTMLAnchorElement>) {
    if (read || !href) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      setRead(true, false);
      return;
    }
    e.preventDefault();
    startTransition(async () => {
      await setNotificationRead(id, true);
      router.push(href);
    });
  }

  const content = (
    <>
      {!read && <span className="sr-only">Unread: </span>}
      {sentence}
    </>
  );

  return (
    <li className={cn("relative flex items-start gap-3 px-4 py-4 transition-colors hover:bg-hover md:px-6", !read && "bg-surface-2")}>
      {!read && <span aria-hidden="true" className="absolute left-1.5 top-9 size-2 -translate-y-1/2 rounded-full bg-fg-1 md:left-2.5" />}
      {visual}
      <div className="min-w-0 flex-1">
        <p id={sentenceId} className="text-small leading-5 text-fg-1">
          {href ? (
            <Link href={href} onClick={follow} className={STRETCH}>
              {content}
            </Link>
          ) : (
            <button type="button" onClick={() => !read && setRead(true, false)} className={cn(STRETCH, "text-left")}>
              {content}
            </button>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-fg-3">
          {time}
          {chips}
        </p>
      </div>
      <div className="relative z-10 -my-1 -mr-1 shrink-0">
        <Menu
          trigger={<Icon icon={Ellipsis} size={16} />}
          triggerLabel="More actions"
          triggerProps={{ "aria-describedby": sentenceId }}
          tooltip
          triggerClassName={buttonClasses({ variant: "ghost", iconOnly: true })}
          label="Notification actions"
          placement="bottom-end"
          sheetOnPhone
        >
          {read ? (
            <MenuItem icon={Circle} onClick={() => setRead(false, true)}>
              Mark as unread
            </MenuItem>
          ) : (
            <MenuItem icon={Check} onClick={() => setRead(true, true)}>
              Mark as read
            </MenuItem>
          )}
          <MenuLink href="/settings" icon={Settings}>
            Notification settings
          </MenuLink>
        </Menu>
      </div>
    </li>
  );
}
