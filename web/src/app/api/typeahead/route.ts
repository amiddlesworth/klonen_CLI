import { NextResponse, type NextRequest } from "next/server";
import type { TypeaheadResponse } from "@/components/shell/typeahead";
import { conferenceShort, levelShort } from "@/lib/format";
import { typeahead } from "@/lib/queries/search";

export const dynamic = "force-dynamic";

/** GET /api/typeahead?q= : a few people and programs for the global search box. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  try {
    const { people, orgs } = await typeahead(q);
    const body: TypeaheadResponse = {
      people: people.map((p) => ({
        slug: p.slug,
        name: p.fullName,
        meta: [p.currentTitle, p.org?.shortName].filter(Boolean).join(" · ") || null,
      })),
      programs: orgs.map((o) => ({
        slug: o.slug,
        name: o.name,
        shortName: o.shortName,
        meta: [levelShort(o.level), conferenceShort(o.conferenceAbbr)].filter(Boolean).join(" · ") || null,
      })),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
