import "server-only";
import { getAvailabilitySummary } from "@/lib/queries/shell";
import type { Session } from "@/lib/session";
import type { Viewer } from "./types";

/** The shell's view of a signed-in demo account (serializable; safe to pass to client components). */
export async function getViewer(session: NonNullable<Session>): Promise<Viewer> {
  const { user, person, org } = session;
  const role = user.kind === "employer" ? "employer" : "coach";
  const availability = role === "coach" && person ? ((await getAvailabilitySummary(person.id).catch(() => null)) ?? { open: false, audience: "all_except_current" as const }) : null;
  return {
    role,
    name: user.name,
    tintKey: person?.slug ?? user.id,
    profileSlug: person?.slug ?? null,
    title: role === "coach" ? (person?.currentTitle ?? null) : "Athletic director",
    orgShortName: org?.shortName ?? null,
    orgSlug: org?.slug ?? null,
    availability,
  };
}
