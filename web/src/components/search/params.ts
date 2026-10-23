/*
 * Search URL state (ARCHITECTURE.md routes): /search?q=&type=people|programs&division=&conference=
 * &state=&role=&workedAt=&workedUnder=&page=. Division, conference, state and role may repeat
 * (checkbox facets); workedAt and workedUnder take one slug each. Plain module: safe on the server
 * and in client components.
 */

export type SearchType = "people" | "programs";

export type FacetKey = "role" | "division" | "conference" | "state";

export type SearchState = {
  q: string;
  type: SearchType;
  role: string[];
  division: string[];
  conference: string[];
  state: string[];
  workedAt: string | null;
  workedUnder: string | null;
  page: number;
};

export type RawParams = Record<string, string | string[] | undefined>;

/** Role groups offered as a facet (DESIGN.md §8.7), in display order. */
export const ROLE_FACET = ["head_coach", "coordinator", "position_coach", "ga_analyst", "support"] as const;

export const ROLE_FACET_LABEL: Record<string, string> = {
  head_coach: "Head coach",
  coordinator: "Coordinator",
  position_coach: "Position coach",
  ga_analyst: "GA / analyst",
  support: "Support",
};

/** Plural nouns for headings and popular searches ("Head coaches in the NWC"). */
export const ROLE_PLURAL: Record<string, string> = {
  head_coach: "Head coaches",
  coordinator: "Coordinators",
  position_coach: "Position coaches",
  ga_analyst: "GAs and analysts",
  support: "Support staff",
};

const MAX_VALUES = 12;

function list(v: string | string[] | undefined): string[] {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  const out: string[] = [];
  for (const s of arr) {
    const t = s.trim().slice(0, 80);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_VALUES) break;
  }
  return out;
}

function one(v: string | string[] | undefined): string | null {
  const s = (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100);
  return s ? s : null;
}

export function parseSearchParams(raw: RawParams): SearchState {
  const type: SearchType = one(raw.type) === "programs" ? "programs" : "people";
  const pageNum = Number.parseInt(one(raw.page) ?? "1", 10);
  return {
    q: (one(raw.q) ?? "").slice(0, 100),
    type,
    role: list(raw.role).filter((r) => (ROLE_FACET as readonly string[]).includes(r)),
    division: list(raw.division),
    conference: list(raw.conference),
    state: list(raw.state).map((s) => s.toUpperCase()),
    workedAt: one(raw.workedAt),
    workedUnder: one(raw.workedUnder),
    page: Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 500) : 1,
  };
}

/** Filters that only apply to people (dropped on the Programs tab). */
export function peopleOnly(s: SearchState): boolean {
  return s.role.length > 0 || !!s.workedAt || !!s.workedUnder;
}

/** Number of applied filters (not counting the query), for "Filters (n)". */
export function appliedCount(s: SearchState): number {
  const base = s.division.length + s.conference.length + s.state.length;
  if (s.type === "programs") return base;
  return base + s.role.length + (s.workedAt ? 1 : 0) + (s.workedUnder ? 1 : 0);
}

/** Anything to list: a query, a filter, or the Programs tab (which lists every program unfiltered). */
export function hasCriteria(s: SearchState): boolean {
  return !!s.q || appliedCount(s) > 0 || s.type === "programs";
}

/**
 * `/search?…` for a state, with overrides. Any change resets the page unless `page` is given.
 * The Programs tab never carries people-only filters.
 */
export function searchHref(s: SearchState, overrides: Partial<SearchState> = {}): string {
  const n: SearchState = { ...s, page: 1, ...overrides };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  if (n.type === "programs") p.set("type", "programs");
  if (n.type === "people") for (const v of n.role) p.append("role", v);
  for (const v of n.division) p.append("division", v);
  for (const v of n.conference) p.append("conference", v);
  for (const v of n.state) p.append("state", v);
  if (n.type === "people" && n.workedAt) p.set("workedAt", n.workedAt);
  if (n.type === "people" && n.workedUnder) p.set("workedUnder", n.workedUnder);
  if (n.page > 1) p.set("page", String(n.page));
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

/** The state with one facet value toggled off. */
export function without(s: SearchState, key: FacetKey, value: string): SearchState {
  return { ...s, [key]: s[key].filter((v) => v !== value) };
}

/** Everything cleared except the query and the tab. */
export function cleared(s: SearchState): SearchState {
  return { ...s, role: [], division: [], conference: [], state: [], workedAt: null, workedUnder: null, page: 1 };
}

export const STATE_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export function stateName(code: string): string {
  return STATE_NAME[code] ?? code;
}

const ROLE_NOUN: Record<string, [string, string]> = {
  head_coach: ["head coach", "head coaches"],
  coordinator: ["coordinator", "coordinators"],
  position_coach: ["position coach", "position coaches"],
  ga_analyst: ["GA or analyst", "GAs and analysts"],
  support: ["support staff member", "support staff"],
};

/**
 * A noun phrase for the filters, without the query: "head coaches in the USA South",
 * "coaches who worked under Ian Falconer", "programs in Oregon". Multi-value facets fall back to
 * the plain noun (the applied-filter chips list them). `n` picks singular or plural.
 */
export function describeFilters(s: SearchState, names: { workedAt?: string | null; workedUnder?: string | null } = {}, n = 2): string {
  const one = n === 1;
  let noun: string;
  if (s.type === "programs") noun = one ? "program" : "programs";
  else if (s.role.length === 1) noun = ROLE_NOUN[s.role[0]]?.[one ? 0 : 1] ?? (one ? "coach" : "coaches");
  else noun = one ? "coach" : "coaches";
  const where: string[] = [];
  if (s.conference.length === 1) where.push(`the ${s.conference[0]}`);
  else if (s.division.length === 1 && s.conference.length === 0) where.push(s.division[0].replace(/^D-/, "Division "));
  if (s.state.length === 1) where.push(stateName(s.state[0]));
  let phrase = where.length ? `${noun} in ${where.join(", ")}` : noun;
  if (s.type === "people" && names.workedUnder && names.workedAt) phrase += ` who worked under ${names.workedUnder} and at ${names.workedAt}`;
  else if (s.type === "people" && names.workedUnder) phrase += ` who worked under ${names.workedUnder}`;
  else if (s.type === "people" && names.workedAt) phrase += ` who worked at ${names.workedAt}`;
  return phrase;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "1 coach" / "62 coaches", with a thousands separator. */
export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
