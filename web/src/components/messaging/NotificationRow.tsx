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
  /** Avatar 40, org tile 40, or a plain 40px icon box for notifications about the viewer's account. */
  visual: ReactNode;
  /** One sentence, names 600. */
  sentence: ReactNode;
  /** Why it matters to the viewer, as a ContextLine ("Pacific (OR) · your program"). */
  context?: ReactNode;
  /** Chips on the time line (Sample listing). */
  chips?: ReactNode;
  /** The time line ("2026 season" and the source for a move, the season for a job, "5h" for a message); null for none. */
  time: ReactNode;
};

const STRETCH =
  "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus focus-visible:after:outline-solid";

const FAILED = "We couldn't update this notification.";

/**
 * Notification row (§8.16): avatar or tile 40, one sentence 13/20, an optional ContextLine, the time
 * 12 --fg-3 and More. Unread rows sit on --surface-2 with an 8px ink dot centred in a 24px left gutter
 * (rows start at 24px at every width, so the dot never sits at the screen edge) and a second cue that
 * doesn't depend on the dot or the faint band (audit m4): the unread sentence is 500 --fg-1, a read
 * one 400 --fg-2. Screen readers hear "Unread". The whole row is one link; following it marks the notification read first, with
 * the row dimmed and busy meanwhile, and navigates even when marking read fails.
 */
export function NotificationRow({ id, read, href, visual, sentence, context, chips, time }: NotificationRowProps) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [following, startFollow] = useTransition();
  const sentenceId = useId();
  const router = useRouter();

  const setRead = (value: boolean, announce: boolean) =>
    startTransition(async () => {
      let ok = false;
      try {
        ok = (await setNotificationRead(id, value)).ok;
      } catch {
        ok = false;
      }
      if (announce || !ok) toast.show(ok ? (value ? "Marked as read" : "Marked as unread") : FAILED);
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
    if (following) return;
    startFollow(async () => {
      try {
        await setNotificationRead(id, true);
      } catch {
        // Offline or a stale action: still go where the row leads.
      } finally {
        // In the transition too, so the row stays busy until the destination renders.
        startFollow(() => router.push(href));
      }
    });
  }

  const content = (
    <>
      {!read && <span className="sr-only">Unread: </span>}
      {sentence}
    </>
  );

  return (
    <li
      aria-busy={following || undefined}
      className={cn(
        "relative flex items-start gap-3 py-4 pl-6 pr-4 transition-colors hover:bg-hover md:px-6",
        !read && "bg-surface-2",
        following && "cursor-progress bg-hover [&>*]:opacity-60",
      )}
    >
      {/* Centred in the 24px gutter at every width (x 8–16), level with the avatar's centre. */}
      {!read && <span aria-hidden="true" className="absolute left-2 top-9 size-2 -translate-y-1/2 rounded-full bg-fg-1" />}
      {visual}
      <div className="min-w-0 flex-1">
        <p id={sentenceId} className={cn("text-small leading-5", read ? "text-fg-2" : "font-medium text-fg-1")}>
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
        {context}
        {(time || chips) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-fg-3">
            {time}
            {chips}
          </p>
        )}
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
            Settings
          </MenuLink>
        </Menu>
      </div>
    </li>
  );
}
