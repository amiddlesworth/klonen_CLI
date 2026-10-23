/**
 * Place names for program headers. Registry programs carry a state but no city, so the header reads
 * "Boxers · Oregon" rather than a bare "OR"; compact rows keep the two-letter abbreviation.
 */
const STATE_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  PR: "Puerto Rico",
};

/** "OR" -> "Oregon"; unknown codes pass through. */
export function stateName(code: string | null | undefined): string | null {
  if (!code) return null;
  return STATE_NAME[code.toUpperCase()] ?? code;
}

/** "City, ST" when both are known, else the state name, else null. */
export function placeLine(city: string | null | undefined, state: string | null | undefined): string | null {
  if (city && state) return `${city}, ${state}`;
  return city || stateName(state);
}
