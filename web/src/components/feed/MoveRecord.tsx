import { SeasonRange } from "@/components/data/SeasonRange";
import { cn } from "@/lib/cn";
import type { RecordRow } from "@/lib/queries/feedx";
import { recordTitle } from "./text";

/**
 * Move record (§8.3): the last 2–3 stints, oldest first, ending on the new role. Year column 56px
 * (compact ranges, 12/500 tabular --fg-3), a 7px dot on a 1px --border-strong rail, then
 * "{title} · {org}" 13/20 --fg-2. The new role is --fg-1 with a 600 year and title and a filled ink
 * dot. No border or fill around it.
 */
export function MoveRecord({ rows, label }: { rows: RecordRow[]; label: string }) {
  return (
    <ol aria-label={label} className="relative">
      {rows.map((r, i) => {
        const last = i === rows.length - 1;
        const title = `${recordTitle(r.role)}${r.asPlayer ? " (player)" : ""}`;
        return (
          <li
            key={r.key}
            className={cn("relative grid grid-cols-[56px_16px_minmax(0,1fr)] items-baseline py-[3px] text-small leading-5 max-md:grid-cols-[52px_16px_minmax(0,1fr)]", r.now ? "text-fg-1" : "text-fg-2")}
          >
            <SeasonRange
              variant="compact"
              startYear={r.startYear}
              endYear={r.endYear}
              isCurrent={r.isCurrent}
              inferred={r.inferred && r.startYear !== null}
              className={cn(r.now ? "font-semibold text-fg-1" : "text-fg-3")}
            />
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[60px] top-2.5 size-[7px] rounded-full max-md:left-14",
                r.now ? "bg-fg-1" : "bg-surface shadow-[inset_0_0_0_1.5px_var(--control)]",
              )}
            />
            {!last && <span aria-hidden="true" className="absolute -bottom-[9px] left-[63px] top-[19px] border-l border-border-strong max-md:left-[59px]" />}
            <span className="col-start-3 min-w-0">
              {r.now ? <b className="font-semibold">{title}</b> : title}
              {r.org && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>
                  {r.org}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
