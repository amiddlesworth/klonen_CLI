"use client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { dayKey, fullDateTime } from "./format";

/**
 * The viewer's time zone once mounted. The first render uses UTC so it matches the server's HTML;
 * the effect then switches to the runtime zone (undefined), as ThreadView does for clock times.
 */
export function useViewerZone(): string | undefined {
  const [zone, setZone] = useState<string | undefined>("UTC");
  useEffect(() => setZone(undefined), []);
  return zone;
}

/**
 * A server-rendered relative time ("5h") whose tooltip gives the full date and time in the viewer's
 * zone (the server renders in UTC).
 */
export function LocalTime({ iso, className, children }: { iso: string; className?: string; children: ReactNode }) {
  const zone = useViewerZone();
  return (
    <time dateTime={iso} title={fullDateTime(new Date(iso), zone)} className={className}>
      {children}
    </time>
  );
}

type DayGroupsProps = {
  /** The rows (NotificationRow <li>s), newest first, each with its timestamp. */
  rows: { id: number; at: string; node: ReactNode }[];
  /** "Now" on the server, so the first render matches its HTML. */
  now: string;
};

function Group({ id, label, rows, divided }: { id: string; label: string; rows: DayGroupsProps["rows"]; divided: boolean }) {
  return (
    <section aria-labelledby={id} className={divided ? "border-t border-divider" : undefined}>
      <h2 id={id} className="px-4 pb-2 pt-4 text-small font-semibold text-fg-2 md:px-6">
        {label}
      </h2>
      <ul className="divide-y divide-divider border-t border-divider">
        {rows.map((r) => (
          <Fragment key={r.id}>{r.node}</Fragment>
        ))}
      </ul>
    </section>
  );
}

/**
 * Notification rows grouped Today and Earlier by the viewer's calendar day (UTC until mounted, so
 * hydration matches the server's HTML).
 */
export function DayGroups({ rows, now }: DayGroupsProps) {
  const zone = useViewerZone();
  const today = dayKey(new Date(now), zone);
  const todays = rows.filter((r) => dayKey(new Date(r.at), zone) === today);
  const earlier = rows.filter((r) => dayKey(new Date(r.at), zone) !== today);
  return (
    <>
      {todays.length > 0 && <Group id="notifications-today" label="Today" rows={todays} divided={false} />}
      {earlier.length > 0 && <Group id="notifications-earlier" label="Earlier" rows={earlier} divided={todays.length > 0} />}
    </>
  );
}
