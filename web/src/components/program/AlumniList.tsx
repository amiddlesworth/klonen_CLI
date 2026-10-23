import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredFootnote } from "@/components/data/InferredYear";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import type { AlumniEntry } from "@/lib/queries/program";
import { LedgerPersonRow, LedgerUndated } from "./LedgerPersonRow";
import { LedgerRange, rangeHasInferred } from "./LedgerRange";
import { displayTitle, nowLine, peopleCount } from "./text";

export const ALUMNI_PAGE_SIZE = 50;

type AlumniListProps = {
  id: string;
  title: string;
  subtitle?: ReactNode;
  entries: AlumniEntry[];
  /** "coached": the line is the role held here; "played": the position played here. */
  kind: "coached" | "played";
  /** Empty state; the card is hidden when omitted and there are no entries. */
  empty?: { icon?: LucideIcon; title: string; description?: string };
  /** 1-based page, with links built by hrefForPage. Lists over 50 rows paginate (ARCHITECTURE.md). */
  page?: number;
  hrefForPage?: (page: number) => string;
  /** Show the inferred-year footnote in this card when a row has one (once per page, §6.2). */
  explainInferred?: boolean;
};

/**
 * Alumni coaches / Played here (§8.6): rows of person, "{role here}" with the seasons here in the
 * ledger column ("2003, 2006–2009 · 5 seasons · 2 stints") and a "Now {title} at {program}" context
 * line. Most recent first.
 */
export function AlumniList({ id, title, subtitle, entries, kind, empty, page = 1, hrefForPage, explainInferred = true }: AlumniListProps) {
  if (!entries.length && !empty) return null;
  const totalPages = Math.max(1, Math.ceil(entries.length / ALUMNI_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const rows = entries.slice((current - 1) * ALUMNI_PAGE_SIZE, current * ALUMNI_PAGE_SIZE);
  const hasInferred = explainInferred && rows.some((e) => rangeHasInferred(e.stints));

  return (
    <Card id={id} padding="main" aria-labelledby={`${id}-title`} className="scroll-mt-[calc(var(--nav-h)+16px)]">
      <CardHeader id={`${id}-title`} title={title} meta={entries.length ? peopleCount(entries.length) : undefined} subtitle={subtitle} />
      {!entries.length && empty ? (
        <EmptyState {...empty} spacing="md" />
      ) : (
        <>
          <ul className="divide-y divide-divider">
            {rows.map((e) => {
              const now = nowLine(e.person.currentTitle, e.person.org?.shortName);
              const extraRoles = kind === "coached" && e.roleCount > 1 ? e.roleCount - 1 : 0;
              const dated = e.stints.some((s) => s.startYear);
              return (
                <li key={e.person.id} className="py-3 first:pt-0 last:pb-0">
                  <LedgerPersonRow
                    person={e.person}
                    line={
                      <>
                        {displayTitle(e.role) ?? e.role}
                        {extraRoles > 0 && (
                          <>
                            {/* The "·" is glued to the title's last word (no-break space), so a wrapped line never starts with it;
                                the note wraps as a unit, so a bare number never ends a line. */}
                            <span className="text-fg-3">{" ·"}</span>{" "}
                            <span className="whitespace-nowrap text-fg-3">
                              {extraRoles} earlier {extraRoles === 1 ? "role" : "roles"} here
                            </span>
                          </>
                        )}
                      </>
                    }
                    context={now ? <ContextLine>{now}</ContextLine> : undefined}
                    ledger={
                      dated ? (
                        <LedgerRange stints={e.stints} />
                      ) : (
                        <LedgerUndated>Years not in source</LedgerUndated>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
          {hasInferred && <InferredFootnote className="mt-3">Dotted years are inferred from the coach&apos;s bio, not stated in it.</InferredFootnote>}
          {hrefForPage && totalPages > 1 && (
            <Pagination
              className="mt-4 border-t border-divider pt-4"
              page={current}
              totalPages={totalPages}
              prevHref={current > 1 ? hrefForPage(current - 1) : null}
              nextHref={current < totalPages ? hrefForPage(current + 1) : null}
            />
          )}
        </>
      )}
    </Card>
  );
}
