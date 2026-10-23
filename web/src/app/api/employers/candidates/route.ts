import { NextResponse, type NextRequest } from "next/server";
import { CANDIDATE_OPTION_LIMIT, getEmployerShortlists, searchCandidateOptions, type CandidateOption } from "@/lib/queries/employer";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Response of GET /api/employers/candidates?q=&list= (the pipeline's "Add candidate" dialog). */
export type CandidateOptionsResponse = { options: CandidateOption[]; more: boolean; limit: number } | { error: string };

const HEADERS = { "Cache-Control": "private, no-store" };

/**
 * Coaches matching a name or program, each with the stage they already hold in `list` (when that
 * search is the caller's). A GET read, like /api/typeahead, so typing never queues behind the
 * pipeline's server actions and a superseded request can be aborted. Employer sessions only.
 */
export async function GET(req: NextRequest) {
  const session = await getSession().catch(() => null);
  if (session?.user.kind !== "employer") {
    return NextResponse.json<CandidateOptionsResponse>({ error: "Switch to the athletic director demo account to add candidates." }, { status: 403, headers: HEADERS });
  }
  const params = req.nextUrl.searchParams;
  const q = (params.get("q") ?? "").slice(0, 100);
  const rawList = params.get("list");
  try {
    let listId: number | null = null;
    if (rawList && /^\d{1,9}$/.test(rawList)) {
      const id = Number(rawList);
      listId = (await getEmployerShortlists(session.user.id)).some((l) => l.id === id) ? id : null;
    }
    const { options, more } = await searchCandidateOptions(q, listId);
    return NextResponse.json<CandidateOptionsResponse>({ options, more, limit: CANDIDATE_OPTION_LIMIT }, { headers: HEADERS });
  } catch {
    return NextResponse.json<CandidateOptionsResponse>({ error: "Search didn't load." }, { status: 500, headers: HEADERS });
  }
}
