import "server-only";
import { cookies } from "next/headers";

/**
 * When this browser last opened /notifications (audit X22, LinkedIn's model): the Notifications badge
 * counts only unread notifications newer than this, so visiting the page clears the badge while the
 * rows themselves stay unread-styled until they are clicked or marked read. Per browser, in a cookie,
 * because the demo accounts are shared: one visitor opening the page must not clear another's badge.
 */
export const NOTIFICATIONS_SEEN_COOKIE = "cn_notif_seen";

/** One year: the badge only needs to remember the last visit. */
export const NOTIFICATIONS_SEEN_MAX_AGE = 365 * 24 * 60 * 60;

/** This browser's last visit to /notifications, or null (never, malformed, or outside a request). */
export async function readNotificationsSeenAt(): Promise<Date | null> {
  try {
    const v = (await cookies()).get(NOTIFICATIONS_SEEN_COOKIE)?.value;
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
