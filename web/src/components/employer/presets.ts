import { parseSearchParams, ROLE_PLURAL, searchHref, type SearchState } from "@/components/search/params";
import { conferenceShort, levelShort, type RoleGroup } from "@/lib/format";
import type { EmployerProgram } from "@/lib/queries/employer";

export type SearchPreset = { label: string; href: string };

/** What a preset searches for, in the shape the search feature counts (lib/queries/searchx PeopleCriteria). */
export type PresetCriteria = { q?: string; role?: string[]; division?: string[]; conference?: string[]; workedUnderId?: string | null };

/** A preset plus its criteria, so the page can count it and drop it when it would come back empty. */
export type PresetSpec = SearchPreset & { criteria: PresetCriteria };

const BLANK: SearchState = parseSearchParams({});

/**
 * One people search, built with the search feature's own URL helper so the link and the count use
 * the same values (division as the URL and chips show it: "D-III", never "NCAA D-III").
 */
function spec(label: string, s: Partial<Pick<SearchState, "q" | "role" | "division" | "conference">>, workedUnder?: { slug: string; id: string }): PresetSpec {
  const state: SearchState = { ...BLANK, ...s, workedUnder: workedUnder?.slug ?? null };
  return {
    label,
    href: searchHref(state),
    criteria: { q: state.q || undefined, role: state.role, division: state.division, conference: state.conference, workedUnderId: workedUnder?.id ?? null },
  };
}

function pluralize(phrase: string): string {
  if (/(s|x|ch|sh)$/i.test(phrase)) return `${phrase}es`;
  if (/[^aeiou]y$/i.test(phrase)) return `${phrase.slice(0, -1)}ies`;
  return `${phrase}s`;
}

const DEMO_SUFFIX = /\s*\(demo\)\s*$/i;

/**
 * Whether a search is a seeded demo record. Until shortlists carry their own is_demo flag, the seed
 * marks its searches with a trailing "(demo)" in the name; searches the account creates itself
 * (Add candidate, Post a job) are its own records and carry no chip.
 */
export function isDemoSearch(name: string): boolean {
  return DEMO_SUFFIX.test(name);
}

/**
 * The search's name as shown next to its Demo chip: the trailing "(demo)" is dropped because the
 * chip already says it ("Defensive analyst search (demo)" → "Defensive analyst search").
 */
export function searchDisplayName(name: string): string {
  return name.replace(DEMO_SUFFIX, "") || name;
}

/** The role a search is for, from its name: "Defensive analyst search (demo)" → "Defensive analyst". */
function searchRole(name: string | null): string | null {
  const role = name
    ?.replace(/\([^)]*\)/g, " ")
    .replace(/\bsearch\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return role && role.toLowerCase() !== "shortlist" && role.length <= 40 ? role : null;
}

/** Role group a search name points at ("…coordinator…" → coordinator); coordinators by default. */
function searchRoleGroup(name: string | null): RoleGroup {
  const n = name?.toLowerCase() ?? "";
  if (/\b(analyst|graduate assistant|ga|quality control|intern)\b/.test(n)) return "ga_analyst";
  if (/\bcoordinator\b/.test(n)) return "coordinator";
  if (/\bhead coach\b/.test(n)) return "head_coach";
  if (/\bcoach\b/.test(n)) return "position_coach";
  return "coordinator";
}

/**
 * "Find candidates" targets, best first: the search's role group in the employer's division, then
 * the whole division. The page links to the first one that returns anyone (else plain /search).
 */
export function findCandidatesSpecs(searchName: string | null, program: EmployerProgram | null): PresetSpec[] {
  const division = levelShort(program?.level);
  const group = searchRoleGroup(searchName);
  const specs = [spec("Find candidates", { role: [group], division: division ? [division] : [] })];
  if (division) specs.push(spec("Find candidates", { division: [division] }));
  return specs;
}

/**
 * Quick searches under the pipeline header, from what the employer is hiring for and who they are:
 * the role in the search name ("Defensive analyst search" → defensive analysts in the division),
 * the same rung (one rung down for coordinator and head coach searches) in the employer's own
 * conference, and its head coach's tree. The page drops any that would come back empty.
 */
export function pipelinePresetSpecs(searchName: string | null, program: EmployerProgram | null): PresetSpec[] {
  const presets: PresetSpec[] = [];
  const division = levelShort(program?.level);
  const role = searchRole(searchName);
  if (role) {
    const sentence = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    presets.push(spec(pluralize(sentence), { q: role.toLowerCase(), division: division ? [division] : [] }));
  }
  const group = searchRoleGroup(searchName);
  const pool: RoleGroup = group === "coordinator" ? "position_coach" : group === "head_coach" ? "coordinator" : group;
  const conf = conferenceShort(program?.conferenceAbbr);
  if (conf) presets.push(spec(`${ROLE_PLURAL[pool]} in the ${conf}`, { role: [pool], conference: [conf] }));
  else if (division) presets.push(spec(`${ROLE_PLURAL[pool]} in ${division}`, { role: [pool], division: [division] }));
  if (program?.headCoach) {
    // Labeled as the tree, not "Worked under…": most of it is usually the employer's own staff.
    presets.push(spec(`${program.headCoach.fullName}'s tree`, {}, program.headCoach));
  }
  return presets;
}
