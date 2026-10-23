/*
 * Feed copy helpers (DESIGN.md §6.3). Pure functions, safe on server and client. Feed sentences use
 * AP style: lowercase titles joined with "and" and commas, never "/" or parentheses. Record rows use
 * sentence case with commas. Pronouns never appear: we repeat the first name or use neutral phrasing.
 */

/** Drops leftovers from source tables: "Head Coach (2025- )" -> "Head Coach"; "OC | OL" -> "OC / OL". */
export function cleanTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .replace(/\s*\(\s*\d{4}\s*[-–]\s*(?:\d{2,4})?\s*\)\s*$/, "")
    .replace(/\s*\|\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- Words ---------- */

/** Words kept capitalized in AP prose: Sam/Mike/Will linebackers. */
const KEEP_CASE = new Map([
  ["sam", "Sam"],
  ["sams", "Sams"],
  ["mike", "Mike"],
  ["mikes", "Mikes"],
  ["will", "Will"],
  ["wills", "Wills"],
  ["h-back", "H-back"],
  ["h-backs", "H-backs"],
]);

/** Lowercases a title word unless it is an acronym ("JV", "NFL") or has inner capitals ("McKay"). */
function lowerWord(w: string): string {
  const keep = KEEP_CASE.get(w.toLowerCase());
  if (keep) return keep;
  if (/^[A-Z0-9&.'’-]{2,}$/.test(w)) return w;
  if (/^[A-Z][a-z]+[A-Z]/.test(w)) return w;
  return w.toLowerCase();
}

function lowerPhrase(s: string): string {
  return s
    .replace(/\s*&\s*/g, " and ")
    .split(" ")
    .filter(Boolean)
    .map(lowerWord)
    .join(" ")
    .replace(/\bbill walsh\b/g, "Bill Walsh");
}

/** Expands the abbreviations that read badly in prose: "Asst. QB Coach" -> "Assistant Quarterbacks Coach". */
function expandAbbreviations(t: string): string {
  return t
    .replace(/\(\s*co-\s*\)\s*/gi, "Co-")
    .replace(/\bAsst\b\.?/g, "Assistant")
    .replace(/\bAssoc\b\.?/g, "Associate")
    .replace(/\bCoord\b\.?/g, "Coordinator")
    .replace(/\bQBs?\b/g, "Quarterbacks")
    .replace(/\bWRs?\b/g, "Wide Receivers")
    .replace(/\bRBs?\b/g, "Running Backs")
    .replace(/\bTEs?\b/g, "Tight Ends")
    .replace(/\bOLBs?\b/g, "Outside Linebackers")
    .replace(/\bILBs?\b/g, "Inside Linebackers")
    .replace(/\bOL\b/g, "Offensive Line")
    .replace(/\bDL\b/g, "Defensive Line")
    .replace(/\bLBs?\b/g, "Linebackers")
    .replace(/\bDBs?\b/g, "Defensive Backs")
    .replace(/\bS&C\b/g, "Strength and Conditioning")
    .replace(/\bSTC\b/g, "Special Teams Coordinator")
    .replace(/\bOC\b/g, "Offensive Coordinator")
    .replace(/\bDC\b/g, "Defensive Coordinator")
    .replace(/\bGA\b/g, "Graduate Assistant")
    .replace(/\bQC\b/g, "Quality Control")
    .replace(/\bHS\b/g, "High School")
    // A glued unit after a role: "Associate Head Coach-Defense" -> "Associate Head Coach for Defense".
    .replace(/\b(Coach|Coordinator|Assistant)\s*-(?=[A-Z])/g, "$1 for ");
}

/** Position-group words: a title made only of these names a position, not a role ("Linebackers"). */
const POSITION_WORDS = new Set(
  (
    "quarterback quarterbacks running back backs wide receiver receivers tight end ends offensive defensive line lines linemen lineman " +
    "linebacker linebackers inside outside safeties safety cornerback cornerbacks corner corners nickel nickels secondary special teams " +
    "specialists kicker kickers punter punters long snappers fullback fullbacks h-back h-backs edge edges tackle tackles slot returner returners " +
    "return interior perimeter center centers guard guards sam sams mike mikes will wills star stars offense defense passing game run " +
    "running skill positions position and"
  ).split(" "),
);

/** Head nouns that make a phrase a role ("defensive coordinator", "director of operations"). */
const ROLE_HEAD =
  /^(coach|coaches|coordinator|co-coordinator|assistant|assistants|director|analyst|intern|manager|trainer|liaison|advisor|adviser|facilitator|chief|staff|member|specialist|play-caller|caller|videographer|fellow|scout|recruiter|captain|player|volunteer|consultant|officer|president|administrator|founder|owner|instructor|teacher|mentor|chaplain|dean|professor|lecturer|supervisor|counselor|chair)$/i;
// "control" is not a role noun: bare "quality control" reads as "quality control coach" (kind "bare").

/** The head noun of a phrase: the last word before "of", "for", "to" or "in" ("director of football operations" -> "director"). */
function headNoun(phrase: string): string {
  const core = phrase.replace(/^(promoted to|then|later|named)\s+/i, "").split(/\s+(?:of|for|to|in|under|with|at|during)\s+/i)[0];
  const words = core.trim().split(/\s+/);
  return words[words.length - 1] ?? "";
}

function hasRoleHead(phrase: string): boolean {
  return ROLE_HEAD.test(headNoun(phrase));
}

function isPosition(phrase: string): boolean {
  const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => POSITION_WORDS.has(w)) && !(words.length === 1 && words[0] === "and");
}

/** A role that takes its position group as a "for" phrase: "assistant coach", "graduate assistant", "defensive assistant". */
function isGenericRole(phrase: string): boolean {
  const p = phrase.toLowerCase();
  if (/^((assistant|volunteer|graduate|student|part-time|full-time|football|offensive|defensive)\s+)*(assistant|coach)(\s+coach)?$/.test(p)) return true;
  return false;
}

/* ---------- Title structure ---------- */

type Segment = { text: string; qualifier: boolean; notes: string[] };

/**
 * Splits a title at top-level "/", ",", ";" and spaced dashes, keeping parenthetical notes with the
 * segment they follow. A spaced dash introduces a qualifier ("Assistant Coach - Wide Receivers").
 */
function segments(title: string): Segment[] {
  const out: Segment[] = [];
  let cur: Segment = { text: "", qualifier: false, notes: [] };
  let depth = 0;
  let note = "";
  const push = (qualifierNext: boolean) => {
    if (cur.text.trim() || cur.notes.length) out.push({ ...cur, text: cur.text.trim() });
    cur = { text: "", qualifier: qualifierNext, notes: [] };
  };
  for (let i = 0; i < title.length; i++) {
    const c = title[i];
    if (c === "(") {
      if (depth === 0) note = "";
      else note += c;
      depth++;
      continue;
    }
    if (c === ")") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        if (note.trim()) cur.notes.push(note.trim());
      } else note += c;
      continue;
    }
    if (depth > 0) {
      note += c;
      continue;
    }
    if (c === "/" || c === "," || c === ";") {
      push(false);
      continue;
    }
    if ((c === "-" || c === "–" || c === "—") && title[i - 1] === " " && title[i + 1] === " ") {
      push(true);
      continue;
    }
    cur.text += c;
  }
  push(false);
  return out;
}

type Item = { text: string; kind: "generic" | "role" | "position" | "bare"; quals: string[]; tail: string[] };

function kindOf(text: string): Item["kind"] {
  if (isGenericRole(text)) return "generic";
  if (hasRoleHead(text)) return "role";
  if (isPosition(text)) return "position";
  return "bare";
}

const NOTE_PREPOSITION = /^(under|with|at|in|for|during|from|on|through)\s/i;
/** Notes that summarize rather than name roles ("roles included ...", "various roles"): prose drops them. */
const NOTE_SUMMARY = /^(roles?|including|incl\.?|various|multiple|several|also\s+\w+\s+at times)\b/i;

/** Builds the AP items of a title: roles, positions and the "for" qualifiers attached to them. */
function items(title: string): Item[] {
  const list: Item[] = [];
  for (const seg of segments(expandAbbreviations(cleanTitle(title)))) {
    const text = lowerPhrase(seg.text.replace(/^(and|also)\s+/i, ""));
    const prev = list[list.length - 1];
    if (text) {
      const kind = kindOf(text);
      if (prev && seg.qualifier) prev.quals.push(text);
      else if (prev && kind === "position" && (prev.kind === "generic" || prev.quals.length > 0)) prev.quals.push(text);
      else list.push({ text, kind, quals: [], tail: [] });
    }
    const owner = list[list.length - 1];
    for (const raw of seg.notes) {
      if (NOTE_SUMMARY.test(raw)) continue;
      // "under Nick Saban": a phrase that reads on after the role, names kept as written.
      if (NOTE_PREPOSITION.test(raw) && owner) {
        owner.tail.push(raw.replace(NOTE_PREPOSITION, (m) => m.toLowerCase()));
        continue;
      }
      for (const part of raw.split(/\s*[,;/]\s*/)) {
        const sub = lowerPhrase(part.replace(/^(and|also)\s+/i, "").trim());
        if (!sub) continue;
        if (NOTE_PREPOSITION.test(sub) && owner) owner.tail.push(sub);
        else if (isPosition(sub) && owner) owner.quals.push(sub);
        else if (hasRoleHead(sub)) list.push({ text: sub, kind: isGenericRole(sub) ? "generic" : "role", quals: [], tail: [] });
        else if (/\bquality control$/.test(sub)) list.push({ text: sub, kind: "bare", quals: [], tail: [] });
        // Anything else ("various roles", "student", "remote") is a note the record row keeps; prose drops it.
      }
    }
  }
  return list;
}

export function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Joins finished items. Two items where the second is a shared-"coach" run take a comma instead, so
 * the sentence doesn't stack "and": "offensive coordinator, quarterbacks and running backs coach".
 */
function joinItems(parts: { text: string; run: boolean }[]): string {
  if (parts.length === 2 && parts[1].run) return `${parts[0].text}, ${parts[1].text}`;
  return joinAnd(parts.map((p) => p.text));
}

/**
 * AP title for feed sentences (§6.3): lowercase, "and" instead of "/", no parentheses, and a role
 * noun on every part. "Offensive Coordinator / Quarterbacks" -> "offensive coordinator and
 * quarterbacks coach"; "Assistant Coach (Linebackers)" -> "assistant coach for linebackers";
 * "Wide Receivers / Tight Ends" -> "wide receivers and tight ends coach"; "Head Coach (Offensive
 * Coordinator)" -> "head coach and offensive coordinator".
 */
export function apTitle(title: string): string {
  const out: { text: string; run: boolean }[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length) out.push({ text: `${joinAnd(run)} coach`, run: run.length > 1 });
    run = [];
  };
  for (const it of items(title)) {
    // Consecutive bare position groups share one "coach": "wide receivers and tight ends coach".
    if (it.kind === "position" && !it.quals.length && !it.tail.length) {
      run.push(...it.text.split(" and ").filter(Boolean));
      continue;
    }
    flush();
    const noun = it.kind === "position" || it.kind === "bare" ? `${it.text} coach` : it.text;
    const quals = it.quals.length ? ` for ${joinAnd(it.quals)}` : "";
    const tail = it.tail.length ? ` ${it.tail.join(" ")}` : "";
    out.push({ text: `${noun}${quals}${tail}`, run: false });
  }
  flush();
  return joinItems(out) || "staff member";
}

/* ---------- Record rows ---------- */

/**
 * Sentence-case title for record rows and facts lines (§8.3 MoveRecord), with the same clean-up the
 * headline gets: abbreviations spelled out, "/" and parenthetical notes turned into comma-separated
 * parts, "(Co-)" into "co-" and a glued unit into "for": "Offensive Coordinator / Quarterbacks" ->
 * "Offensive coordinator, quarterbacks"; "Head Coach (Offensive Coordinator)" -> "Head coach,
 * offensive coordinator"; "Associate Head Coach-Defense" -> "Associate head coach for defense".
 * A "(player)" note is dropped: the row adds its own, the only parenthetical a row keeps.
 */
export function recordTitle(title: string): string {
  const parts: string[] = [];
  for (const seg of segments(expandAbbreviations(cleanTitle(title)))) {
    const text = lowerPhrase(seg.text.trim());
    if (text) parts.push(text);
    for (const raw of seg.notes) {
      const note = raw.trim();
      if (/^(as a )?player$/i.test(note)) continue;
      // "under Nick Saban" reads on after the role, names kept as written.
      if (NOTE_PREPOSITION.test(note) && parts.length) {
        parts[parts.length - 1] += ` ${note.replace(NOTE_PREPOSITION, (m) => m.toLowerCase())}`;
        continue;
      }
      for (const part of note.split(/\s*[,;/]\s*/)) {
        const sub = lowerPhrase(part.trim());
        if (sub) parts.push(sub);
      }
    }
  }
  const s = parts.join(", ");
  return s ? s[0].toUpperCase() + s.slice(1) : "Staff member";
}

/* ---------- Comparing roles ---------- */

function keyWords(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/\b(coach|coaches|football)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * A title reduced to what it names, for comparing two titles: case, word order, "coach" and
 * "football" don't count, and a generic "assistant coach" counts only through its position group.
 * "Head Football Coach" = "Head coach"; "Assistant Coach - Linebackers" = "Linebackers Coach";
 * "Wide Receivers / Tight Ends" = "Tight Ends / Wide Receivers".
 */
export function titleKey(title: string | null | undefined): string {
  if (!title) return "";
  const atoms = new Set<string>();
  for (const it of items(title)) {
    const quals = it.quals.flatMap((q) => q.split(" and ")).map(keyWords).filter(Boolean);
    if (it.kind === "generic") {
      if (quals.length) quals.forEach((q) => atoms.add(q));
      else atoms.add(keyWords(it.text) || "assistant");
      continue;
    }
    const parts = it.kind === "position" ? it.text.split(" and ") : [it.text];
    parts.map(keyWords).filter(Boolean).forEach((p) => atoms.add(p));
    quals.forEach((q) => atoms.add(q));
  }
  return [...atoms].sort().join("|");
}

/** True when two published titles name the same role ("Head Football Coach" and "Head coach"). */
export function sameTitle(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = titleKey(a);
  return !!ka && ka === titleKey(b);
}

/**
 * Seniority of one role phrase, lower is more senior: 0 head coach, 1 associate or assistant head
 * coach, 2 offensive or defensive coordinator, 3 special teams or game coordinator, 4 position coach,
 * 4.5 assistant position coach or unit assistant, 5 graduate assistant, student, volunteer, intern,
 * analyst or quality control. Null for staff roles outside the ladder (operations, video, strength).
 */
function phraseRank(p: string): number | null {
  const s = p.toLowerCase();
  // "Running backs coach and recruiting coordinator": rank each joined role on its own.
  const joined = s.split(/\s+and\s+/);
  if (joined.length > 1 && joined.every((x) => hasRoleHead(x) || isPosition(x))) {
    let best: number | null = null;
    for (const x of joined) {
      const r = phraseRank(isPosition(x) ? `${x} coach` : x);
      if (r !== null && (best === null || r < best)) best = r;
    }
    return best;
  }
  const minor = /\b(jv|junior varsity|freshman|futures|middle school|grade|youth|away|home|7v7|u\d+)\b/.test(s);
  if (/\b(graduate assistant|student|volunteer|intern|quality control|analyst)\b/.test(s)) return 5;
  if (/\bto the head coach\b/.test(s)) return null;
  // JV, freshman and futures roles sit beside the varsity ladder, not on it.
  const head = /\b(assistant|associate) head coach\b/.test(s) ? 1 : /\bhead (football )?coach\b/.test(s) ? 0 : null;
  if (head !== null) return minor ? null : head;
  if (/\b(co-)?(offensive|defensive) coordinator\b/.test(s) && !/\bassistant\b/.test(s)) return minor ? null : 2;
  if (/\b(co-)?(special teams|passing game|pass game|run game|running game) coordinator\b/.test(s) && !/\bassistant\b/.test(s)) return minor ? null : 3;
  const unit = s.match(/^(.*?)\s*\bassistant$/);
  if (unit && unit[1] && isPosition(unit[1])) return 4.5; // "defensive assistant", "offensive line assistant"
  if (/\bassistant\b/.test(s) && !/\bassistant (football )?coach\b/.test(s)) {
    // "Assistant defensive line coach", "assistant quarterbacks": an assistant to a position coach.
    const rest = s.replace(/.*\bassistant\b/, "").replace(/\bcoach(es)?\b/g, "").trim();
    if (rest && isPosition(rest)) return 4.5;
    if (/\bcoordinator\b/.test(s)) return 4;
    return null;
  }
  if (/\bcoordinator\b/.test(s)) return null;
  if (/\bcoach(es)?\b/.test(s)) {
    if (/\b(strength|conditioning|speed|performance|skill trainer)\b/.test(s) && !/\b(offensive|defensive|line|backs|ends|receivers|linebackers|quarterbacks|safeties|corners|cornerbacks|specialists|special teams)\b/.test(s)) return null;
    return 4;
  }
  if (isPosition(s)) return 4;
  return null;
}

/** Seniority of a whole title: its most senior part (see phraseRank). Null when no part is on the coaching ladder. */
export function roleRank(title: string | null | undefined): number | null {
  if (!title) return null;
  let best: number | null = null;
  for (const it of items(title)) {
    let r = phraseRank(it.kind === "position" || it.kind === "bare" ? `${it.text} coach` : it.text);
    // "Offensive assistant / specialists": coaching a position group is position-coach work.
    if (it.kind === "generic" && it.quals.length && r !== 5) r = r === null ? 4 : Math.min(r, 4);
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}

/* ---------- Sources ---------- */

/** "https://www.goboxers.com/sports/..." -> "goboxers.com". */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Plain-words reason for an inferred year (§6.2), for the tooltip after "Inferred: ". Quotes the
 * staff-bio evidence only when the quote passes the copy rule (no gendered pronouns).
 */
export function inferredReason(evidence: string | null | undefined, sourceUrl: string | null | undefined): string {
  const domain = domainOf(sourceUrl);
  const bio = domain ? `the ${domain} staff bio` : "the staff bio";
  const q = evidence?.trim().replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "");
  if (q && isNeutralQuote(q)) {
    const short = q.length > 140 ? `${q.slice(0, 137).trimEnd()}…` : q;
    return `from ${bio}, which says “${short}”`;
  }
  return `not stated in ${bio}; worked out from other details in it`;
}

/* ---------- Quotes ---------- */

/** A line that only restates a hire (this one or an earlier one) adds nothing under the headline. */
const RESTATES_HIRE = /\b(joins|joined|enters|entering|rejoins|rejoined|returns|returned|named|hired|welcomed|welcomes|first season|as (its|the|their) new)\b/i;

/**
 * A verbatim line from the new staff bio for the card's QuoteBlock, or null. It must add a fact
 * without restating a hire, and it must not describe an earlier stint as if it backed this move: a
 * line that names an earlier season and not this one is left out when it is about this program (for
 * a promotion, a role change or a return (`withinProgram`), every such line is; for a hire, one
 * that names the program), since it describes an earlier stint here, not this season's move.
 */
export function pickQuote(excerpt: string | null, withinProgram: boolean, programShortName: string, season: number): string | null {
  if (!excerpt) return null;
  const q = excerpt.trim().replace(/\s+/g, " ");
  if (q.length < 30 || q.length > 240) return null;
  if (!/^[A-Z“"]/.test(q)) return null;
  if (!isNeutralQuote(q) || RESTATES_HIRE.test(q)) return null;
  const years = (q.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number);
  const earlierOnly = years.some((y) => y < season) && !years.includes(season);
  const aboutProgram = withinProgram || q.toLowerCase().includes(programShortName.replace(/\s*\(.*\)$/, "").toLowerCase());
  if (earlierOnly && aboutProgram) return null;
  return q;
}

/* ---------- Names and numbers ---------- */

/**
 * A program name for running text with its parenthetical and any "&" glued to the word before
 * ("St. Thomas (Minnesota)", "William & Mary"), so a wrapped line never starts with "(" or "&"
 * (§11 rule 12).
 */
export function keepTogether(name: string): string {
  return name.replace(/\s+\(/g, "\u00a0(").replace(/\s+&\s+/g, "\u00a0& ");
}

/* ---------- Organizations in prose ---------- */

/** The fields of an organization the prose helpers read. */
export type OrgRef = { id: string; shortName: string; level: string | null };

/**
 * Placeholder organizations from the dataset ("org-unknown-high-school"): a bio mentions a school or
 * team without naming it. They never read as proper nouns: prose says "a high school", record rows
 * show a muted "High school (not named in the bio)".
 */
const UNNAMED: Record<string, { noun: string; label: string; pro: boolean }> = {
  "high-school": { noun: "a high school", label: "High school", pro: false },
  pro: { noun: "a pro team", label: "Pro team", pro: true },
  college: { noun: "another college", label: "College", pro: false },
  other: { noun: "another program", label: "Organization", pro: false },
};

/** The placeholder kind of an unnamed organization, or null for a real one. */
export function unnamedOrg(id: string): { noun: string; label: string; pro: boolean } | null {
  if (!id.startsWith("org-unknown-")) return null;
  return UNNAMED[id.slice("org-unknown-".length)] ?? UNNAMED.other;
}

const isPro = (org: OrgRef) => org.level === "pro/semi-pro";

/** A league rather than a team: "Canadian Football League", "The Spring League" (not "Lodz Wolves (Polish League …)"). */
export function isLeague(name: string): boolean {
  const base = name.replace(/\s*\(.*?\)\s*/g, " ").trim();
  return /\bLeague$/i.test(base) && !base.includes(",");
}

/** "the Atlanta Falcons", "The Spring League" (a name that starts with "The" keeps it as written). */
function withThe(name: string): string {
  return /^the\s/i.test(name) ? keepTogether(name) : `the ${keepTogether(name)}`;
}

/**
 * Where a coaching stint was, for running text: "at Michigan Tech", "with the Atlanta Falcons", "in
 * the Canadian Football League", "at a high school", "with a pro team".
 */
export function atOrg(org: OrgRef): string {
  const unnamed = unnamedOrg(org.id);
  if (unnamed) return `${unnamed.pro ? "with" : "at"} ${unnamed.noun}`;
  if (isPro(org)) return isLeague(org.shortName) ? `in ${withThe(org.shortName)}` : `with ${withThe(org.shortName)}`;
  return `at ${keepTogether(org.shortName)}`;
}

/** A playing stint, for running text: "played at George Fox", "played for the Atlanta Falcons", "played in the Canadian Football League". */
export function playedAt(org: OrgRef): string {
  const unnamed = unnamedOrg(org.id);
  if (unnamed) return `played ${unnamed.pro ? "for" : "at"} ${unnamed.noun}`;
  if (isPro(org)) return isLeague(org.shortName) ? `played in ${withThe(org.shortName)}` : `played for ${withThe(org.shortName)}`;
  return `played at ${keepTogether(org.shortName)}`;
}

/** A program name in a list ("Previously at X and Y"): the plain name, or "a high school" for a placeholder. */
export function orgListName(org: OrgRef): string {
  return unnamedOrg(org.id)?.noun ?? keepTogether(org.shortName);
}

/** True when years in parentheses would stack on the name's own: "St. Thomas (Minnesota) (2024–2025)". */
export function endsInParen(name: string): boolean {
  return /\)\s*$/.test(name);
}

/** AP possessive ending for a name: "Joe Doyle" -> "’s", "E.J. Mills" -> "’". */
export function possessiveEnding(name: string): string {
  return /s$/i.test(name.trim()) ? "’" : "’s";
}

/** AP ordinal: first through ninth spelled out, then figures: 10th, 21st, 42nd, 113th. */
export function ordinal(n: number): string {
  const words = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
  if (n >= 0 && n < 10) return words[n];
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** True for titles that only say "staff" ("Coaching staff", "Staff member"): sentences say "on the staff" instead. */
export function isStaffOnly(title: string): boolean {
  return /^((coaching|offensive|defensive|football|support)\s+)?staff(\s+member)?$/i.test(cleanTitle(title));
}

/** First name for labels ("Coached under Ian"). */
export function firstNameOf(fullName: string, firstName?: string | null): string {
  return firstName?.trim() || fullName.trim().split(/\s+/)[0] || fullName;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** AP numbers: one through nine spelled out, 10 and up as figures. */
export function apNumber(n: number): string {
  return n >= 0 && n < 10 ? NUMBER_WORDS[n] : String(n);
}

/** "Portland State University" -> "Portland State" (a school's short label in context lines). */
export function schoolShort(name: string): string {
  return name
    .replace(/^(The )?University of /i, "")
    .replace(/\s+(University|College)$/i, "")
    .trim();
}

/** Normalized school name for comparing alma maters. */
export function schoolKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const k = schoolShort(name).toLowerCase().replace(/[^a-z]/g, "");
  return k || null;
}

/** True when a verbatim quote can be shown under the copy rule: no gendered pronouns. */
export function isNeutralQuote(text: string): boolean {
  return !/\b(he|him|his|himself|she|her|hers|herself)\b/i.test(text);
}

/** A stable 32-bit FNV-1a hash, for deterministic tie-breaks that don't read as alphabetical. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Position keys of a title for "Matches your position group": "Special Teams Coordinator / DBs" -> ["special teams", ...]. */
export function positionKeys(title: string | null | undefined): string[] {
  if (!title) return [];
  return cleanTitle(title)
    .toLowerCase()
    .split(/\s*[/,&|]\s*|\s+and\s+/)
    .map((p) =>
      p
        .replace(/\b(assistant|associate|asst\.?|assoc\.?|co-|senior|graduate|coach(es)?|coordinator|coord\.?|director|of|the|position|intern)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((p) => p.length > 2 && !/^(head|football|defensive|offensive|recruiting|operations)$/.test(p));
}
