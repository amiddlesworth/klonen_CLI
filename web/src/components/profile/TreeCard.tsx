import Link from "next/link";
import { ArrowRight, Building2, Flag, Network } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredKey, InferredYear } from "@/components/data/InferredYear";
import { SectionCard } from "@/components/data/SectionCard";
import { keepParen, TitleOrg } from "@/components/data/TitleOrg";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { TextLink } from "@/components/ui/TextLink";
import { cn } from "@/lib/cn";
import { titleShort } from "@/lib/format";
import type { TreeContext, TreeModel, TreeRowModel } from "./model";
import { InlineYears, TreeRuns } from "./TreeYears";

type TreeCardProps = {
  model: TreeModel;
  slug: string;
  firstName: string;
  personName: string;
  /** Explain the dotted year here (when no Experience legend on the page does). */
  explainInferred?: boolean;
  /** A fictional demo candidate: no real coach is linked, and none will be. */
  isDemo?: boolean;
};

const PHONE_ROWS = 3;

/**
 * Coaching tree card (§8.4, id="tree"): Worked under and Worked alongside on the left, Coached under
 * {first} on the right in a two-column grid (lg); stacked below lg with 3 rows per long group and
 * "All {n} →". When the left groups outnumber the mentees (or there are only one or two mentees),
 * the narrow left column would crowd, so every group stacks full width in the two-column grid.
 * Counts are unique people; the footnote names anyone listed twice. Empty groups are hidden; a tree
 * with no one in it shows a quiet empty state.
 */
export function TreeCard({ model, slug, firstName, personName, explainInferred, isDemo }: TreeCardProps) {
  if (!model.groups.length) {
    return (
      <SectionCard
        id="tree"
        title="Coaching tree"
        empty={
          isDemo
            ? { icon: Network, title: "No coaching tree.", description: `${firstName} is a fictional demo candidate, so no real coach is linked.` }
            : { icon: Network, title: "No coaching tree yet.", description: `It fills in as coaches who worked with ${firstName} are added.` }
        }
      />
    );
  }
  const left = model.groups.filter((g) => g.key !== "mentees");
  const right = model.groups.find((g) => g.key === "mentees");
  const leftRows = left.reduce((n, g) => n + g.rows.length, 0);
  const split = left.length > 0 && !!right && right.rows.length > 2 && right.rows.length >= leftRows;

  return (
    <SectionCard
      id="tree"
      title="Coaching tree"
      meta={`${model.unique} ${model.unique === 1 ? "person" : "people"}`}
      action={
        <TextLink href={`/in/${slug}/tree`} arrow target24 className="text-small" aria-label={`Explore ${personName}'s coaching tree`}>
          Explore tree
        </TextLink>
      }
    >
      <div className={cn("border-t border-divider", split && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]")}>
        {left.length > 0 && (
          <div className={cn("min-w-0 pt-3", split && "lg:pr-6")}>
            {left.map((g) => (
              <TreeGroup key={g.key} id={g.key} label={g.label} rows={g.rows} columns={split ? 1 : 2} capLg={split ? 4 : 8} slug={slug} />
            ))}
          </div>
        )}
        {right && (
          <div className={cn("min-w-0 pt-3", left.length > 0 && "mt-3 border-t border-divider", split && "lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6")}>
            <TreeGroup id={right.key} label={right.label} rows={right.rows} columns={2} capLg={8} slug={slug} />
          </div>
        )}
      </div>
      <p className="mt-2 border-t border-divider pt-3 text-caption text-fg-3">
        {model.footnote}
        {/* The card explains its own dotted years (audit C03): the Experience legend covers Experience and Playing career only. */}
        {explainInferred && model.inferred && (
          <>
            {" "}
            <InferredKey />
          </>
        )}
      </p>
    </SectionCard>
  );
}

function TreeGroup({ id, label, rows, columns, capLg, slug }: { id: string; label: string; rows: TreeRowModel[]; columns: 1 | 2; capLg: number; slug: string }) {
  const n = rows.length;
  const shownLg = Math.min(n, capLg);
  const shownSm = Math.min(n, PHONE_ROWS);
  const lastRowLg = columns === 2 ? shownLg % 2 || 2 : 1;
  const headingId = `tree-${id}`;
  return (
    <section aria-labelledby={headingId} className="[&+&]:mt-4">
      <h3 id={headingId} className="flex justify-between gap-2 text-small leading-5 font-semibold">
        {label}
        <span className="num font-medium text-fg-3">{n}</span>
      </h3>
      <ul className={cn(columns === 2 && "lg:grid lg:grid-cols-2 lg:gap-x-6")}>
        {rows.slice(0, capLg).map((r, i) => (
          <li key={r.person.id} className={cn(i >= PHONE_ROWS && "max-lg:hidden")}>
            <TreeRow row={r} className={cn(i === shownSm - 1 && "max-lg:border-b-0", i >= shownLg - lastRowLg && "lg:border-b-0")} />
          </li>
        ))}
      </ul>
      {n > PHONE_ROWS && (
        <Link
          href={`/in/${slug}/tree`}
          className={cn(
            "inline-flex min-h-11 items-center gap-0.5 text-small font-medium text-link underline-offset-2 hover:underline lg:mt-1 lg:min-h-6",
            n <= capLg && "lg:hidden",
          )}
        >
          {/* It opens the tree page: an arrow, as every link to another page (audit X23); chevrons mean disclosure. */}
          All {n}
          <Icon icon={ArrowRight} size={14} />
        </Link>
      )}
    </section>
  );
}

function TreeRow({ row, className }: { row: TreeRowModel; className?: string }) {
  const p = row.person;
  const title = p.currentTitle ? titleShort(p.currentTitle) : null;
  const program = p.org?.shortName ? keepParen(p.org.shortName) : null;
  return (
    <Link href={`/in/${p.slug}`} className={cn("group/row flex min-h-11 items-start gap-2.5 border-b border-divider py-2.5", className)}>
      <Avatar name={p.fullName} tintKey={p.slug} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="truncate text-small font-semibold text-fg-1 underline-offset-2 group-hover/row:underline">{p.fullName}</span>
          {/* Every period the two shared (TreeLink.periods), oldest first: "2010–12, 2020–". */}
          <TreeRuns runs={row.runs} className="shrink-0 leading-[18px]" />
        </div>
        {(title || program) && (
          <p className="min-w-0 text-caption text-fg-2">
            <TitleOrg title={title} org={program} />
          </p>
        )}
        {row.context && <TreeContextLine context={row.context} />}
      </div>
    </Link>
  );
}

/** "Played for Ian 2024–25" (flag), "Joined Ian's staff in 2020" (tree), "At Oberlin" (program). */
function TreeContextLine({ context }: { context: TreeContext }) {
  if (context.kind === "player") {
    return (
      <ContextLine icon={Flag} className="mt-0.5">
        {context.text}
        {context.years.kind === "range" && (
          <>
            {" "}
            <InlineYears view={context.years} />
          </>
        )}
      </ContextLine>
    );
  }
  if (context.kind === "joined") {
    const { year } = context;
    return (
      <ContextLine icon={Network} className="mt-0.5">
        {context.text}{" "}
        <span className="num">{year.inferred ? <InferredYear reason={year.reason}>{year.value}</InferredYear> : year.value}</span>
      </ContextLine>
    );
  }
  // A long program name ("University at Buffalo, the State University of New York") stays on one line.
  return (
    <ContextLine icon={Building2} className="mt-0.5">
      <span className="block truncate">{context.text}</span>
    </ContextLine>
  );
}
