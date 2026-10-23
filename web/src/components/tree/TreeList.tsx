import Link from "next/link";
import { Building2, Network } from "lucide-react";
import { DemoLabel } from "@/components/data/Badges";
import { ContextLine } from "@/components/data/ContextLine";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/cn";
import { titleShort } from "@/lib/format";
import type { SecondLevelMember, TreeExplorer, TreeMember, TreePerson } from "@/lib/queries/tree";
import { GROUP_LABEL, possessive, rangeView, rowContext, secondContext, type ContextView, type GroupKey, type RangeView } from "./copy";
import { ContextText, RangeText } from "./TreeRange";

type Row = { key: string; person: TreePerson; range: RangeView; context: ContextView | null; contextIcon: "tree" | "program" };

type Columns = "split-left" | "split-right" | "full";

/** Grid columns per placement: stacked groups use 2 columns from md; at lg the split mirrors the profile card. */
const GRID: Record<Columns, string> = {
  "split-left": "md:grid md:grid-cols-2 md:gap-x-6 lg:block",
  "split-right": "md:grid md:grid-cols-2 md:gap-x-6",
  full: "md:grid md:grid-cols-2 md:gap-x-6 lg:grid-cols-3",
};

/**
 * Every person in the tree, grouped exactly as the profile's tree card (DESIGN.md §8.4) but never
 * truncated: Worked under and Worked alongside on the left, Coached under {first} on the right
 * (lg); stacked below lg. With depth 2, "Two steps up" and "Two steps down" follow. This is the
 * phone layout and the accessible equivalent of the diagram.
 */
export function TreeList({ data, viewerId }: { data: TreeExplorer; viewerId: string | null }) {
  const first = data.focal.firstName;
  const toRows = (group: GroupKey, members: TreeMember[]): Row[] =>
    members.map((m) => {
      const context = rowContext(group, m.edges, data, m.person.id);
      return { key: `${group}:${m.person.id}`, person: m.person, range: rangeView(m.edges), context, contextIcon: context?.year ? "tree" : "program" };
    });
  const left = [
    { key: "mentors" as const, label: GROUP_LABEL.mentors(), rows: toRows("mentors", data.mentors) },
    { key: "peers" as const, label: GROUP_LABEL.peers(), rows: toRows("peers", data.peers) },
  ];
  const mentees = { key: "mentees" as const, label: GROUP_LABEL.mentees(first), rows: toRows("mentees", data.mentees) };
  const hasLeft = left.some((g) => g.rows.length > 0);
  const split = hasLeft && mentees.rows.length > 0;

  return (
    <>
      <div className={cn("border-t border-divider", split && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]")}>
        <div className={cn("min-w-0 pt-3", split && "lg:pr-6")}>
          {left.map((g) => (
            <TreeGroup key={g.key} id={`tree-${g.key}`} label={g.label} rows={g.rows} columns={split ? "split-left" : "full"} viewerId={viewerId} />
          ))}
          {!split && <TreeGroup id="tree-mentees" label={mentees.label} rows={mentees.rows} columns="full" viewerId={viewerId} />}
        </div>
        {split && (
          <div className="mt-4 min-w-0 border-t border-divider pt-3 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6">
            <TreeGroup id="tree-mentees" label={mentees.label} rows={mentees.rows} columns="split-right" viewerId={viewerId} />
          </div>
        )}
      </div>
      {data.second && <SecondLevel data={data} viewerId={viewerId} />}
    </>
  );
}

function SecondLevel({ data, viewerId }: { data: TreeExplorer; viewerId: string | null }) {
  const first = data.focal.firstName;
  const toRows = (dir: "up" | "down", members: SecondLevelMember[]): Row[] =>
    members.map((m) => ({
      key: `${dir}:${m.person.id}`,
      person: m.person,
      range: rangeView(m.links[0].edges),
      context: { text: secondContext(dir, m.links[0].via, m.links[0].edges) + (m.links.length > 1 ? ` and ${m.links.length - 1} more` : "") },
      contextIcon: "tree",
    }));
  const second = data.second!;
  return (
    <div className="mt-4 border-t border-divider pt-3">
      <TreeGroup
        id="tree-up"
        label={GROUP_LABEL.up()}
        caption={`Who ${possessive(first)} head coaches had worked under by the time they coached ${first}`}
        rows={toRows("up", second.up)}
        columns="full"
        viewerId={viewerId}
      />
      <TreeGroup
        id="tree-down"
        label={GROUP_LABEL.down()}
        caption={`On the staff of a head coach who coached under ${first}`}
        rows={toRows("down", second.down)}
        columns="full"
        viewerId={viewerId}
      />
    </div>
  );
}

function TreeGroup({ id, label, caption, rows, columns, viewerId }: { id: string; label: string; caption?: string; rows: Row[]; columns: Columns; viewerId: string | null }) {
  const headingId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20 [&+&]:mt-4">
      <h3 id={headingId} className="flex justify-between gap-2 text-small leading-5 font-semibold">
        {label}
        <span className="num font-medium text-fg-3">{rows.length}</span>
      </h3>
      {caption && <p className="text-caption text-fg-3">{caption}</p>}
      {rows.length ? (
        // Rows carry a top divider; the -1px offset inside overflow-hidden hides the first row's line in every column.
        <div className="overflow-hidden">
          <ul className={cn("-mt-px", GRID[columns])}>
            {rows.map((r) => (
              <TreeRow key={r.key} row={r} you={r.person.id === viewerId} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="py-2 text-small text-fg-3">No one yet.</p>
      )}
    </section>
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
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-small font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{p.fullName}</span>
              {you && <Chip title="This is your profile">You</Chip>}
              {p.isDemo && <DemoLabel />}
            </span>
            <RangeText view={row.range} className="shrink-0 leading-[18px]" />
          </div>
          {/* The title truncates; the program after it never does (DESIGN.md §6.3). */}
          {(title || program) && (
            <p className="flex min-w-0 text-caption text-fg-2">
              {title && <span className="min-w-0 truncate">{title}</span>}
              {program && (
                <span className="shrink-0 whitespace-nowrap">
                  {title ? " · " : ""}
                  {program}
                </span>
              )}
            </p>
          )}
          {row.context && (
            <ContextLine icon={row.contextIcon === "tree" ? Network : Building2}>
              <ContextText view={row.context} />
            </ContextLine>
          )}
        </div>
      </Link>
      <ButtonLink href={`/in/${p.slug}/tree`} variant="ghost" size="sm" icon={Network} aria-label={`${possessive(p.fullName)} coaching tree`} className="mt-2 max-md:mt-0.5">
        Tree
      </ButtonLink>
    </li>
  );
}
