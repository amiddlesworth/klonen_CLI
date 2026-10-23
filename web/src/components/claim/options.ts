import { ROLE_GROUP_LABEL, type AvailabilityAudience, type RoleGroup } from "@/lib/format";

/*
 * Choices for the Open to opportunities form (§8.12). Plain data, shared by the form (client) and
 * the saveAvailability server action, which accepts only these values.
 */

export const AUDIENCES: AvailabilityAudience[] = ["search_firms", "selected_programs", "all_except_current"];

/** Role groups a coach can say they'd consider, in career order. */
export const ROLE_CHOICES: { value: RoleGroup; label: string }[] = (["head_coach", "coordinator", "position_coach", "ga_analyst", "support"] as const).map(
  (value) => ({ value, label: ROLE_GROUP_LABEL[value] }),
);

export type Region = { value: string; label: string; states: string[] };

/** US regions by state, so a coach can say "New England" rather than pick six states. */
export const REGIONS: Region[] = [
  { value: "new_england", label: "New England", states: ["CT", "MA", "ME", "NH", "RI", "VT"] },
  { value: "mid_atlantic", label: "Mid-Atlantic", states: ["DC", "DE", "MD", "NJ", "NY", "PA"] },
  { value: "southeast", label: "Southeast", states: ["FL", "GA", "NC", "SC", "VA", "WV"] },
  { value: "south_central", label: "South Central", states: ["AL", "AR", "KY", "LA", "MS", "OK", "TN", "TX"] },
  { value: "great_lakes", label: "Great Lakes", states: ["IL", "IN", "MI", "OH", "WI"] },
  { value: "plains", label: "Upper Midwest and Plains", states: ["IA", "KS", "MN", "MO", "ND", "NE", "SD"] },
  { value: "west", label: "West", states: ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NM", "NV", "OR", "UT", "WA", "WY"] },
];

export const ROLE_VALUES = new Set<string>(ROLE_CHOICES.map((r) => r.value));
export const REGION_VALUES = new Set<string>(REGIONS.map((r) => r.value));

/** The region a state belongs to (null for unknown states). */
export function regionForState(state: string | null | undefined): Region | null {
  if (!state) return null;
  return REGIONS.find((r) => r.states.includes(state)) ?? null;
}
