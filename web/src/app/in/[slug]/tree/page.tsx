import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/shell/Layouts";
import { peopleCount, possessive } from "@/components/tree/copy";
import { TreeDiagramCard, TreeEmptyCard, TreeListCard } from "@/components/tree/TreeCards";
import { TreeBreadcrumb, TreeHeader } from "@/components/tree/TreeHeader";
import { BRAND } from "@/lib/brand";
import { getTreeExplorer } from "@/lib/queries/tree";
import { getSession } from "@/lib/session";
import { absoluteUrl } from "@/lib/site";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Options = { view: "diagram" | "list" | null; depth: 1 | 2; all: boolean };

function readOptions(sp: Record<string, string | string[] | undefined>): Options {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const view = one(sp.view);
  return { view: view === "list" || view === "diagram" ? view : null, depth: one(sp.depth) === "2" ? 2 : 1, all: one(sp.all) === "1" };
}

/** Phones (not tablets) get the list by default (DESIGN.md §8.8), so they don't download the hidden diagrams. */
function isPhone(userAgent: string | null): boolean {
  return !!userAgent && /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile.+Firefox/i.test(userAgent);
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { slug } = await params;
  const { depth } = readOptions(await searchParams);
  const data = await getTreeExplorer(slug, depth);
  if (!data) return { title: "Coach not found", robots: { index: false } };
  const { focal } = data;
  const title = `${possessive(focal.fullName)} coaching tree`;
  const role = [focal.currentTitle, focal.currentOrg?.name].filter(Boolean).join(" at ");
  const description =
    data.uniqueCount > 0
      ? `${peopleCount(data.uniqueCount)} in the coaching tree of ${focal.fullName}${role ? `, ${role}` : ""}: who ${focal.firstName} worked under, worked alongside and coached. Derived from overlapping seasons on the same staff.`
      : `The coaching tree of ${focal.fullName}${role ? `, ${role}` : ""}, derived from overlapping seasons on the same staff.`;
  return {
    title,
    description,
    alternates: { canonical: `/in/${slug}/tree` },
    openGraph: { title: `${title} · ${BRAND.name}`, description, type: "profile" },
  };
}

/**
 * An "Invite a colleague" email that links to the coach's profile (no backend: a mailto link). The
 * link uses the configured site origin (lib/site.ts), never the request's Host headers.
 */
function inviteHref(slug: string, name: string): string {
  const url = absoluteUrl(`/in/${slug}`);
  const subject = `${name} on ${BRAND.name}`;
  const body = `Have you worked on a staff with ${name}? Coaching trees on ${BRAND.name} are built from overlapping seasons on the same staff. See the profile: ${url}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Coaching tree explorer /in/[slug]/tree (DESIGN.md §8.8). The route layout 404s an unknown slug. */
export default async function TreePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const options = readOptions(await searchParams);
  const [data, session, h] = await Promise.all([getTreeExplorer(slug, options.depth), getSession().catch(() => null), headers()]);
  if (!data) notFound();
  const empty = data.uniqueCount === 0;
  // The signed-in coach's own node is marked "you" (from the session, never hard-coded).
  const viewerId = session?.person?.id ?? null;
  // The view: what the URL says, at every width (?view=diagram on a phone scrolls and zooms the diagram).
  // Without one, phones get the list and skip the diagram's markup; other devices get the diagram from md up
  // and the list at phone widths.
  const mode = options.view !== null ? "explicit" : isPhone(h.get("user-agent")) ? "phone" : "default";
  const view = options.view ?? (mode === "phone" ? "list" : "diagram");

  return (
    <PageContainer breadcrumb={<TreeBreadcrumb data={data} />}>
      <TreeHeader data={data} view={view} depth={options.depth} mode={mode} />
      {empty ? (
        <TreeEmptyCard data={data} inviteHref={inviteHref(slug, data.focal.fullName)} />
      ) : (
        <>
          {view === "diagram" && <TreeDiagramCard data={data} depth={options.depth} viewerId={viewerId} className={mode === "default" ? "max-md:hidden" : undefined} />}
          {(view === "list" || mode === "default") && (
            <TreeListCard data={data} viewerId={viewerId} depth={options.depth} view={view} showAll={options.all} className={view === "diagram" ? "md:hidden" : undefined} />
          )}
        </>
      )}
    </PageContainer>
  );
}
