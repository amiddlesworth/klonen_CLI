import { NextResponse, type NextRequest } from "next/server";
import { pickerOrgs } from "@/lib/queries/searchx";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/programs?q= : options for the search page's "Worked at" picker. Every organization
 * where someone has coached (not only the registry), registry programs first, each with how many
 * coaches have a stint there. Fetched the same way as the "Worked under" picker (/api/search/coaches).
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  try {
    const options = await pickerOrgs(q);
    return NextResponse.json({ options }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
