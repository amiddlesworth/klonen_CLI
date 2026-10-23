import "server-only";
import { permanentRedirect } from "next/navigation";
import { getProgramOrg, type ProgramOrg } from "@/lib/queries/program";

function decodeSlug(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * The organization for a /programs/[slug] URL, matching an uppercase slug to its lowercase page.
 * Null for unknown slugs and for the pipeline's placeholder buckets ("Unnamed high school").
 */
export async function resolveProgramSlug(rawSlug: string): Promise<ProgramOrg | null> {
  const slug = decodeSlug(rawSlug);
  const org = await getProgramOrg(slug);
  if (org) return org;
  const lower = slug.toLowerCase();
  return lower !== slug ? getProgramOrg(lower) : null;
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Sends a non-canonical slug (/programs/PACIFIC-OR?tab=alumni) to the canonical URL with a 308,
 * keeping the query string so the tab and page survive. The layout can't see the query, so the page
 * (and generateMetadata, which runs first for crawlers) calls this.
 */
export function redirectToCanonicalSlug(rawSlug: string, org: ProgramOrg, searchParams: SearchParams): void {
  if (decodeSlug(rawSlug) === org.slug) return;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else if (v != null) qs.append(k, v);
  }
  const query = qs.toString();
  permanentRedirect(`/programs/${encodeURIComponent(org.slug)}${query ? `?${query}` : ""}`);
}
