import { conferenceShort, levelShort, type RoleGroup } from "@/lib/format";
import type { EmployerProgram } from "@/lib/queries/employer";

export type SearchPreset = { label: string; href: string };

const ROLE_PLURAL: Partial<Record<RoleGroup, string>> = {
  head_coach: "Head coaches",
  coordinator: "Coordinators",
  position_coach: "Position coaches",
  ga_analyst: "GAs and analysts",
};

function searchHref(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams({ type: "people" });
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return `/search?${q.toString()}`;
}

function pluralize(phrase: string): string {
  if (/(s|x|ch|sh)$/i.test(phrase)) return `${phrase}es`;
  if (/[^aeiou]y$/i.test(phrase)) return `${phrase.slice(0, -1)}ies`;
  return `${phrase}s`;
}

/**
 * The search's name as shown next to its Demo chip: a trailing "(demo)" is dropped because the
 * chip already says it ("Defensive analyst search (demo)" → "Defensive analyst search").
 */
export function searchDisplayName(name: string, isDemo: boolean): string {
  return isDemo ? name.replace(/\s*\(demo\)\s*$/i, "") || name : name;
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

/** Primary "Find candidates" target: the search's role group in the employer's division (`/search?role=coordinator&division=…`). */
export function findCandidatesHref(searchName: string | null, program: EmployerProgram | null): string {
  return searchHref({ role: searchRoleGroup(searchName), division: program?.level });
}

/**
 * Quick searches under the pipeline header, from what the employer is hiring for and who they are:
 * the role in the search name ("Defensive analyst search" → defensive analysts), coaches one step
 * below that role in the employer's own conference, and coaches who worked under its head coach.
 */
export function pipelinePresets(searchName: string | null, program: EmployerProgram | null): SearchPreset[] {
  const presets: SearchPreset[] = [];
  const role = searchRole(searchName);
  if (role) {
    const sentence = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    presets.push({ label: pluralize(sentence), href: searchHref({ q: role.toLowerCase(), division: program?.level }) });
  }
  const group = searchRoleGroup(searchName);
  // A coordinator search looks one rung down (position coaches ready to step up); others look at the same rung.
  const pool: RoleGroup = group === "coordinator" ? "position_coach" : group === "head_coach" ? "coordinator" : group;
  const conf = conferenceShort(program?.conferenceAbbr);
  if (conf) {
    presets.push({ label: `${ROLE_PLURAL[pool]} in the ${conf}`, href: searchHref({ role: pool, conference: conf }) });
  } else if (program?.level) {
    presets.push({ label: `${ROLE_PLURAL[pool]} in ${levelShort(program.level)}`, href: searchHref({ role: pool, division: program.level }) });
  }
  if (program?.headCoach) {
    presets.push({ label: `Worked under ${program.headCoach.fullName}`, href: searchHref({ workedUnder: program.headCoach.slug }) });
  }
  return presets;
}
