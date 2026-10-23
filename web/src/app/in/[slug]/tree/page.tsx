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

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readOptions(sp: Record<string, string | string[] | undefined>): { view: "diagram" | "list"; depth: 1 | 2 } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return { view: one(sp.view) === "list" ? "list" : "diagram", depth: one(sp.depth) === "2" ? 2 : 1 };
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

/** An "Invite a colleague" email that links to the coach's profile (no backend: a mailto link). */
async function inviteHref(slug: string, name: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = host ? `${proto}://${host}/in/${slug}` : `/in/${slug}`;
  const subject = `${name} on ${BRAND.name}`;
  const body = `Have you worked on a staff with ${name}? Coaching trees on ${BRAND.name} are built from overlapping seasons on the same staff. See the profile: ${url}`;
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Coaching tree explorer /in/[slug]/tree (DESIGN.md §8.8). */
export default async function TreePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const { view, depth } = readOptions(await searchParams);
  const [data, session] = await Promise.all([getTreeExplorer(slug, depth), getSession().catch(() => null)]);
  if (!data) notFound();
  const empty = data.uniqueCount === 0;
  // The signed-in coach's own node is marked "you" (from the session, never hard-coded).
  const viewerId = session?.person?.id ?? null;

  return (
    <PageContainer>
      <TreeBreadcrumb data={data} />
      <TreeHeader data={data} view={view} depth={depth} />
      {empty ? (
        <TreeEmptyCard data={data} inviteHref={await inviteHref(slug, data.focal.fullName)} />
      ) : (
        <>
          {/* Phone always shows the list (the diagram needs width); md and up follow ?view=. */}
          {view === "diagram" && <TreeDiagramCard data={data} depth={depth} viewerId={viewerId} className="max-md:hidden" />}
          <TreeListCard data={data} viewerId={viewerId} className={view === "diagram" ? "md:hidden" : undefined} />
        </>
      )}
    </PageContainer>
  );
}
