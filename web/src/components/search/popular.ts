import "server-only";
import { biggestTree, countPeople, countPrograms, viewerContext, type PeopleCriteria, type ProgramCriteria } from "@/lib/queries/searchx";
import type { Session } from "@/lib/session";
import { parseSearchParams, searchHref, type SearchState } from "./params";

export type PopularSearch = {
  key: string;
  label: string;
  /** Personal reason, from the session ("your conference"). */
  note?: string;
  href: string;
  count: number;
  noun: "coach" | "program";
};

type Spec = {
  key: string;
  label: string;
  note?: string;
  state: Partial<SearchState>;
  people?: PeopleCriteria;
  programs?: ProgramCriteria;
};

const BASE = parseSearchParams({});

/** A name that never breaks across lines ("Ian / Falconer"): non-breaking spaces. */
const keep = (name: string) => name.replace(/ /g, "\u00A0");

/**
 * Suggested searches for the no-query and empty states, each with a real count. Signed-in viewers
 * get searches around their own program first (conference, head coach, program), from the session.
 */
export async function getPopularSearches(session: Session, limit = 6): Promise<PopularSearch[]> {
  const specs: Spec[] = [];
  const orgId = session?.org?.id ?? null;
  const viewerPersonId = session?.person?.id ?? null;
  const [mine, tree] = await Promise.all([orgId ? viewerContext(orgId, viewerPersonId) : Promise.resolve(null), biggestTree()]);

  if (mine) {
    const conf = mine.org.conference;
    const role = session?.user.kind === "employer" ? "coordinator" : "head_coach";
    if (conf)
      specs.push({
        key: "my-conf",
        label: `${role === "head_coach" ? "Head coaches" : "Coordinators"} in the ${conf}`,
        note: "your conference",
        state: { role: [role], conference: [conf] },
        people: { role: [role], conference: [conf] },
      });
    if (mine.headCoach && session?.user.kind === "coach")
      specs.push({
        key: "my-hc",
        label: `Coaches who worked under ${keep(mine.headCoach.fullName)}`,
        note: "your head coach",
        state: { workedUnder: mine.headCoach.slug },
        people: { workedUnderId: mine.headCoach.id },
      });
    specs.push({
      key: "my-program",
      label: `Coaches who worked at ${keep(mine.org.shortName)}`,
      note: "your program",
      state: { workedAt: mine.org.slug },
      people: { workedAtOrgId: mine.org.id },
    });
  }

  specs.push(
    { key: "usa-south-hc", label: "Head coaches in the USA South", state: { role: ["head_coach"], conference: ["USA South"] }, people: { role: ["head_coach"], conference: ["USA South"] } },
    { key: "wiac-coord", label: "Coordinators in the WIAC", state: { role: ["coordinator"], conference: ["WIAC"] }, people: { role: ["coordinator"], conference: ["WIAC"] } },
  );
  if (tree && tree.slug !== specs.find((s) => s.key === "my-hc")?.state.workedUnder)
    specs.push({ key: "biggest-tree", label: `Coaches who worked under ${keep(tree.fullName)}`, state: { workedUnder: tree.slug }, people: { workedUnderId: tree.id } });
  specs.push(
    { key: "tx-pos", label: "Position coaches in Texas", state: { role: ["position_coach"], state: ["TX"] }, people: { role: ["position_coach"], state: ["TX"] } },
    { key: "pa-ga", label: "GAs and analysts in Pennsylvania", state: { role: ["ga_analyst"], state: ["PA"] }, people: { role: ["ga_analyst"], state: ["PA"] } },
    { key: "nescac-programs", label: "Programs in the NESCAC", state: { type: "programs", conference: ["NESCAC"] }, programs: { conference: ["NESCAC"] } },
  );

  const picked = specs.slice(0, limit);
  const counts = await Promise.all(picked.map((s) => (s.programs ? countPrograms(s.programs) : countPeople(s.people ?? {}))));
  return picked
    .map((s, i) => ({
      key: s.key,
      label: s.label,
      note: s.note,
      href: searchHref({ ...BASE, ...s.state }),
      count: counts[i],
      noun: s.programs ? ("program" as const) : ("coach" as const),
    }))
    .filter((p) => p.count > 0);
}
