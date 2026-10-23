import Link from "next/link";
import { Building2, ChevronRight, Flag, Info, Network, type LucideIcon } from "lucide-react";
import { DemoLabel } from "@/components/data/Badges";
import { ContextLine } from "@/components/data/ContextLine";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { titleShort } from "@/lib/format";
import type { SecondLevelMember, TreeExplorer, TreeMember, TreePerson } from "@/lib/queries/tree";
import { GROUP_LABEL, alsoVia, emptySecondLevel, possessive, rangeView, rowContext, treeHref, viaGroups, type ContextView, type GroupKey, type RangeView } from "./copy";
import { ContextText, RangeText } from "./TreeRange";

type Row = { key: string; person: TreePerson; range: RangeView; context: ContextView | null };

type Columns = "split-left" | "split-right" | "full";

/** Lists longer than this show their first rows and a "Show all" link (ARCHITECTURE: paginate lists over 50 rows). */
export const LIST_PAGE = 50;

/** Grid columns per placement: stacked groups use 2 columns from md; at lg the split mirrors the profile card. */
const GRID: Record<Columns, string> = {
  "split-left": "md:grid md:grid-cols-2 md:gap-x-6 lg:block",
  "split-right": "md:grid md:grid-cols-2 md:gap-x-6",
  full: "md:grid md:grid-cols-2 md:gap-x-6 lg:grid-cols-3",
};

const CONTEXT_ICON: Record<ContextView["kind"], LucideIcon> = { player: Flag, joined: Network, support: Info, at: Building2, also: Network };

type TreeListProps = { data: TreeExplorer; viewerId: string | null; depth: 1 | 2; view: "diagram" | "list"; showAll: boolean };

/**
 * Every person in the tree, grouped exactly as the profile's tree card (DESIGN.md §8.4): Worked under
 * and Worked alongside on the left, Coached under {first} on the right (lg); stacked below lg. With
 * depth 2, "Two steps up" and "Two steps down" follow, each grouped under "Via {coach}" subheadings as
 * in the diagram. This is the phone layout and the accessible equivalent of the diagram.
 */
export function TreeList({ data, viewerId, depth, view, showAll }: TreeListProps) {
  const first = data.focal.firstName;
  const toRows = (group: GroupKey, members: TreeMember[]): Row[] =>
    members.map((m) => ({ key: `${group}:${m.person.id}`, person: m.person, range: rangeView(m.edges), context: rowContext(group, m, data) }));
  const left = [
    { key: "mentors" as const, label: GROUP_LABEL.mentors(), rows: toRows("mentors", data.mentors) },
    { key: "peers" as const, label: GROUP_LABEL.peers(), rows: toRows("peers", data.peers) },
  ];
  const mentees = { key: "mentees" as const, label: GROUP_LABEL.mentees(first), rows: toRows("mentees", data.mentees) };
  const hasLeft = left.some((g) => g.rows.length > 0);
  const split = hasLeft && mentees.rows.length > 0;
  const more = (id: string) => (showAll ? null : treeHref(data.focal.slug, { view, depth, all: true, hash: id }));

  return (
    <>
      <div className={cn("border-t border-divider", split && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]")}>
        <div className={cn("min-w-0 pt-3", split && "lg:pr-6")}>
          {left.map((g) => (
            <TreeGroup key={g.key} id={`tree-${g.key}`} label={g.label} rows={g.rows} columns={split ? "split-left" : "full"} viewerId={viewerId} moreHref={more(`tree-${g.key}`)} />
          ))}
          {!split && <TreeGroup id="tree-mentees" label={mentees.label} rows={mentees.rows} columns="full" viewerId={viewerId} moreHref={more("tree-mentees")} />}
        </div>
        {split && (
          <div className="mt-4 min-w-0 border-t border-divider pt-3 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6">
            <TreeGroup id="tree-mentees" label={mentees.label} rows={mentees.rows} columns="split-right" viewerId={viewerId} moreHref={more("tree-mentees")} />
          </div>
        )}
      </div>
      {data.second && <SecondLevel data={data} viewerId={viewerId} moreHref={more} />}
    </>
  );
}

function SecondLevel({ data, viewerId, moreHref }: { data: TreeExplorer; viewerId: string | null; moreHref: (id: string) => string | null }) {
  const first = data.focal.firstName;
  const second = data.second!;
  const empty = second.up.length + second.down.length === 0;
  const sections = [
    { id: "tree-up", label: GROUP_LABEL.up(), caption: `Who ${possessive(first)} head coaches had worked under by the time they coached ${first}`, members: second.up, order: data.mentors },
    { id: "tree-down", label: GROUP_LABEL.down(), caption: `On the staff of a head coach who coached under ${first}`, members: second.down, order: data.mentees },
  ];
  return (
    <div className="mt-4 border-t border-divider pt-3">
      {empty && <p className="mb-3 text-small text-fg-2">{emptySecondLevel(data)}</p>}
      {sections.map((s) => (
        <ViaSection key={s.id} {...s} viewerId={viewerId} moreHref={moreHref(s.id)} />
      ))}
    </div>
  );
}

function ViaSection({
  id,
  label,
  caption,
  members,
  order,
  viewerId,
  moreHref,
}: {
  id: string;
  label: string;
  caption: string;
  members: SecondLevelMember[];
  order: TreeMember[];
  viewerId: string | null;
  moreHref: string | null;
}) {
  const headingId = `${id}-title`;
  let budget = moreHref ? LIST_PAGE : Infinity;
  const groups = viaGroups(members, order).flatMap((g) => {
    if (budget <= 0) return [];
    const shown = g.members.slice(0, budget);
    budget -= shown.length;
    return [{ ...g, shown }];
  });
  const toRow = (m: SecondLevelMember): Row => ({ key: `${id}:${m.person.id}`, person: m.person, range: rangeView(m.links[0].edges), context: alsoVia(m) });
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20 [&+&]:mt-4">
      <h3 id={headingId} className="flex justify-between gap-2 text-small leading-5 font-semibold">
        {label}
        <span className="num font-medium text-fg-3">{members.length}</span>
      </h3>
      <p className="text-caption text-fg-3">{caption}</p>
      {groups.length ? (
        groups.map((g) => (
          <div key={g.via.id} className="mt-3">
            {/* One subheading per coach, as the diagram's caption: the program every row shares is named once. */}
            <h4 className="flex items-baseline justify-between gap-2 text-caption font-medium text-fg-2">
              <span className="flex min-w-0 items-center gap-1">
                <Icon icon={Network} size={12} className="shrink-0" />
                <span className="min-w-0">
                  Via {g.via.fullName}
                  {g.program && <span className="font-normal text-fg-3"> · {g.program}</span>}
                </span>
              </span>
              <span className="num shrink-0 text-fg-3">{g.members.length}</span>
            </h4>
            <RowList rows={g.shown.map(toRow)} columns="full" viewerId={viewerId} />
          </div>
        ))
      ) : (
        <p className="py-2 text-small text-fg-3">No one yet.</p>
      )}
      {moreHref && members.length > LIST_PAGE && <ShowAll href={moreHref} n={members.length} />}
    </section>
  );
}

function ShowAll({ href, n }: { href: string; n: number }) {
  return (
    <Link href={href} className="mt-1 inline-flex min-h-11 items-center gap-0.5 text-small font-medium text-link underline-offset-2 hover:underline md:min-h-6">
      Show all {n}
      <Icon icon={ChevronRight} size={14} />
    </Link>
  );
}

function TreeGroup({ id, label, rows, columns, viewerId, moreHref }: { id: string; label: string; rows: Row[]; columns: Columns; viewerId: string | null; moreHref: string | null }) {
  const headingId = `${id}-title`;
  const shown = moreHref ? rows.slice(0, LIST_PAGE) : rows;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20 [&+&]:mt-4">
      <h3 id={headingId} className="flex justify-between gap-2 text-small leading-5 font-semibold">
        {label}
        <span className="num font-medium text-fg-3">{rows.length}</span>
      </h3>
      {rows.length ? <RowList rows={shown} columns={columns} viewerId={viewerId} /> : <p className="py-2 text-small text-fg-3">No one yet.</p>}
      {moreHref && rows.length > LIST_PAGE && <ShowAll href={moreHref} n={rows.length} />}
    </section>
  );
}

function RowList({ rows, columns, viewerId }: { rows: Row[]; columns: Columns; viewerId: string | null }) {
  // Rows carry a top divider; the -1px offset inside overflow-hidden hides the first row's line in every column.
  return (
    <div className="overflow-hidden">
      <ul className={cn("-mt-px", GRID[columns])}>
        {rows.map((r) => (
          <TreeRow key={r.key} row={r} you={r.person.id === viewerId} />
        ))}
      </ul>
    </div>
  );
}

function TreeRow({ row, you }: { row: Row; you: boolean }) {
  const p = row.person;
  const title = p.currentTitle ? titleShort(p.currentTitle) : null;
  const program = p.org?.shortName ?? null;
  return (
    <li className="flex min-w-0 items-start gap-1 border-t border-divider">
      <Link href={`/in/${p.slug}`} className="group/row flex min-h-11 min-w-0 flex-1 items-start gap-2.5 py-2.5">
        <Avatar name={p.fullName} tintKey={p.slug} size={32} />
        <div className="min-w-0 flex-1">
          {/* 20px line: the dotted mark under an inferred year (3px below the baseline) clears the line below. */}
          <div className="flex min-w-0 items-baseline justify-between gap-2 leading-5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-small font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{p.fullName}</span>
              {you && <Chip title="This is your profile">You</Chip>}
              {p.isDemo && <DemoLabel />}
            </span>
            <RangeText view={row.range} className="shrink-0 leading-5" />
          </div>
          {/* Title · program on one line (DESIGN.md §6.3: truncate titles). When both don't fit, each gives up
              room in proportion to its length, the program never below a few letters, so neither is cut to
              a stub. The separator has a fixed margin, so no stray space follows an ellipsis. */}
          {(title || program) && (
            <p className="flex min-w-0 text-caption text-fg-2">
              {title && <span className="min-w-0 truncate">{title}</span>}
              {title && program && (
                <span aria-hidden="true" className="mx-1 shrink-0">
                  ·
                </span>
              )}
              {program && (
                <span className={cn("truncate whitespace-nowrap", title ? "min-w-[min(4.5rem,40%)]" : "min-w-0")}>
                  {title && <span className="sr-only">, </span>}
                  {program}
                </span>
              )}
            </p>
          )}
          {row.context && (
            <ContextLine icon={CONTEXT_ICON[row.context.kind]}>
              <ContextText view={row.context} />
            </ContextLine>
          )}
        </div>
      </Link>
      {/* The profile links onward on phone; desktop rows also jump straight to this person's tree. */}
      <ButtonLink href={`/in/${p.slug}/tree`} variant="ghost" size="sm" icon={Network} aria-label={`${possessive(p.fullName)} coaching tree`} className="mt-2 gap-1 px-1.5 max-md:hidden">
        Tree
      </ButtonLink>
    </li>
  );
}
