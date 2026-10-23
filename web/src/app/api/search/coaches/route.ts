import { NextResponse, type NextRequest } from "next/server";
import { pickerCoaches } from "@/lib/queries/searchx";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/coaches?q= : options for the search page's "Worked under" picker. Closest name first,
 * then coaches with the most people under them, each with that count (or the title when no one is
 * listed under them), so a pick that would list no one is visible before it is made.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  try {
    const options = await pickerCoaches(q);
    return NextResponse.json({ options }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
