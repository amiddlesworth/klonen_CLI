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

/** The organization for a /programs/[slug] URL; an uppercase slug redirects to its lowercase URL. */
export async function resolveProgramSlug(rawSlug: string): Promise<ProgramOrg | null> {
  const slug = decodeSlug(rawSlug);
  const org = await getProgramOrg(slug);
  if (org) return org;
  const lower = slug.toLowerCase();
  if (lower !== slug && (await getProgramOrg(lower))) permanentRedirect(`/programs/${lower}`);
  return null;
}
