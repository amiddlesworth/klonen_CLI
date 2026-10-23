import { Fragment, type ReactNode } from "react";
import { Network } from "lucide-react";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredYear } from "@/components/data/InferredYear";
import { CURRENT_SEASON } from "@/lib/brand";
import { seasonRangeLabel, seasonRangeMulti, titleShort } from "@/lib/format";
import type { Run, TreeContext, YearMark } from "@/lib/queries/searchx";
import { possessive } from "./params";

/** A year, dotted (with its own reason) when the stint it comes from is inferred (§6.2). */
function Mark({ mark, text }: { mark: YearMark; text?: string }) {
  const t = text ?? String(mark.year);
  return mark.inferred ? <InferredYear reason={mark.reason}>{t}</InferredYear> : <>{t}</>;
}

/** Whether a run has years to show: ongoing with a known start, or past with both bounds. */
const shown = (r: Run) => (r.ongoing ? !!r.start : !!r.start && !!r.end);

/** Compact pieces of one run ("2004–05", "2023–", "2022"); only the inferred bound is dotted. */
function RunParts({ run }: { run: Run }) {
  const s = run.start!;
  if (run.ongoing) return <><Mark mark={s} />–</>;
  const e = run.end!;
  if (e.year === s.year) return <Mark mark={s.inferred ? s : e} />;
  const sameCentury = Math.floor(e.year / 100) === Math.floor(s.year / 100);
  return (
    <>
      <Mark mark={s} />–<Mark mark={e} text={sameCentury ? String(e.year).slice(2) : String(e.year)} />
    </>
  );
}

/** The years in words for screen readers: "2022, 2024, 2 seasons · 2 stints (2022 inferred)". */
function runsLabel(runs: Run[]): string {
  if (runs.length === 1) {
    const r = runs[0];
    return seasonRangeLabel(r.start!.year, r.ongoing ? null : r.end!.year, r.ongoing);
  }
  const { range, count } = seasonRangeMulti(runs.map((r) => ({ startYear: r.start!.year, endYear: r.ongoing ? CURRENT_SEASON : r.end!.year, isCurrent: r.ongoing })));
  return count ? `${range}, ${count}` : range;
}

function inferredYears(runs: Run[]): string[] {
  const out: string[] = [];
  for (const r of runs) {
    if (!r.ongoing && r.start && r.end && r.end.year === r.start.year) {
      if (r.start.inferred || r.end.inferred) out.push(String(r.start.year));
      continue;
    }
    if (r.start?.inferred) out.push(String(r.start.year));
    if (!r.ongoing && r.end?.inferred) out.push(String(r.end.year));
  }
  return out;
}

/** Compact years of one or more runs ("2010–19", "2022, 2024", "2023–") with the full range for screen readers. */
function Years({ runs }: { runs: Run[] }) {
  const list = runs.filter(shown);
  if (!list.length) return null;
  const inf = inferredYears(list);
  return (
    <span className="num whitespace-nowrap">
      <span aria-hidden="true">
        {list.map((r, i) => (
          <Fragment key={i}>
            {i > 0 && ", "}
            <RunParts run={r} />
          </Fragment>
        ))}
      </span>
      <span className="sr-only">
        {runsLabel(list)}
        {inf.length > 0 && ` (${inf.join(" and ")} inferred)`}
      </span>
    </span>
  );
}

/** A start year alone ("since 2020", "in 2026"), dotted when inferred. */
function Since({ mark }: { mark: YearMark }) {
  return (
    <span className="num whitespace-nowrap">
      <span aria-hidden="true">
        <Mark mark={mark} />
      </span>
      <span className="sr-only">
        {mark.year}
        {mark.inferred && " (inferred)"}
      </span>
    </span>
  );
}

/** A program name that never breaks mid-name ("Pacific / (OR)"). */
const Org = ({ name }: { name: string }) => <span className="whitespace-nowrap">{name}</span>;

/** " at Pacific (OR)", or nothing when the row's title line already names that program. */
function At({ org, omit }: { org: string; omit: boolean }) {
  if (omit) return null;
  return (
    <>
      {" at "}
      <Org name={org} />
    </>
  );
}

/** ", 2010–19" after a past relationship, or " · years not in source" when the source doesn't pin them. */
function PastYears({ runs }: { runs: Run[] }) {
  return runs.some(shown) ? (
    <>
      , <Years runs={runs} />
    </>
  ) : (
    <> · years not in source</>
  );
}

/** " · 2 stints" when only the latest of several separate runs is shown. */
function Stints({ n, shownRuns }: { n: number; shownRuns: number }) {
  if (n <= 1 || shownRuns >= n) return null;
  return (
    <>
      {" · "}
      <span className="whitespace-nowrap">
        <span className="num">{n}</span> stints
      </span>
    </>
  );
}

/** " · 2 roles" when back-to-back roles at a program read as one run under the latest role. */
function Roles({ n }: { n: number }) {
  if (n <= 1) return null;
  return (
    <>
      {" · "}
      <span className="whitespace-nowrap">
        <span className="num">{n}</span> roles
      </span>
    </>
  );
}

/** Whether an ongoing run is a new hire this season: "Joined … in 2026" instead of "since 2026". */
const joinedNow = (joined: boolean, run: Run | undefined) => joined && !!run?.start && run.start.year === CURRENT_SEASON;

/**
 * One line of tree context on a person result (§8.7): "On Ian's staff since 2023", "Joined Ian's staff in
 * 2026" (a new hire this season), "Worked under Ian Falconer at Pacific (OR), 2020–24", "Cornerbacks, 2022,
 * 2024", "ST Coord. / LB, 2022–24 · 2 roles", "6 coached under Ian", "On staff with you since 2025". The
 * same words at every width; a long line wraps under its text (program names and years never break).
 * Years come only from the source: an undated current stint shows no start year, and only the inferred
 * bound carries the dotted mark.
 */
export function TreeContextLine({
  ctx,
  firstName,
  mentorNamed,
  orgNamed,
}: {
  ctx: TreeContext | undefined;
  firstName: string;
  /** The heading names the "Worked under" coach: use the first name. */
  mentorNamed?: boolean;
  /** The heading names the "Worked at" program: leave it out of the line. */
  orgNamed?: boolean;
}) {
  if (!ctx) return null;
  let body: ReactNode;
  switch (ctx.kind) {
    case "workedUnder": {
      const who = mentorNamed ? ctx.mentorFirst : ctx.mentorName;
      const latest = ctx.runs[ctx.runs.length - 1];
      if (latest?.ongoing) {
        body = joinedNow(ctx.joined, latest) ? (
          <>
            Joined {possessive(who)} staff
            <At org={ctx.org} omit={ctx.atCurrent} /> in <Since mark={latest.start!} />
            <Stints n={ctx.runs.length} shownRuns={1} />
          </>
        ) : latest.start ? (
          <>
            On {possessive(who)} staff
            <At org={ctx.org} omit={ctx.atCurrent} /> since <Since mark={latest.start} />
            <Stints n={ctx.runs.length} shownRuns={1} />
          </>
        ) : (
          <>
            On {possessive(who)} current staff
            <At org={ctx.org} omit={ctx.atCurrent} />
            <Stints n={ctx.runs.length} shownRuns={1} />
          </>
        );
      } else {
        body = (
          <>
            Worked under {who}
            <At org={ctx.org} omit={ctx.atCurrent} />
            <PastYears runs={ctx.runs} />
          </>
        );
      }
      break;
    }
    case "workedAt": {
      const named = !!orgNamed;
      const run = ctx.runs[0];
      if (ctx.current) {
        const lead = named ? "On staff" : <>On the <Org name={ctx.org} /> staff</>;
        body = joinedNow(ctx.joined, run) ? (
          <>
            {named ? "Joined the staff" : <>Joined the <Org name={ctx.org} /> staff</>} in <Since mark={run!.start!} />
            <Stints n={ctx.stints} shownRuns={1} />
          </>
        ) : run?.start ? (
          <>
            {lead} since <Since mark={run.start} />
            <Stints n={ctx.stints} shownRuns={1} />
          </>
        ) : (
          <>
            {named ? "On the current staff" : <>On the current <Org name={ctx.org} /> staff</>}
            <Stints n={ctx.stints} shownRuns={1} />
          </>
        );
      } else {
        body = (
          <>
            {/* A compact row (§6.3 titleShort, the same at every width): the role, then its years. */}
            {ctx.role ? titleShort(ctx.role, 28) : "Coached"}
            {named ? (ctx.role ? null : " there") : <At org={ctx.org} omit={false} />}
            <PastYears runs={ctx.runs} />
            <Roles n={ctx.roles} />
            <Stints n={ctx.stints} shownRuns={ctx.runs.length} />
          </>
        );
      }
      break;
    }
    case "viewer": {
      const latest = ctx.runs[ctx.runs.length - 1];
      const at = <At org={ctx.org} omit={ctx.atCurrent} />;
      if (latest?.ongoing && joinedNow(ctx.joined, latest)) {
        const year = <Since mark={latest.start!} />;
        body =
          ctx.relation === "mentor" ? (
            <>
              Became your head coach{at} in {year}
            </>
          ) : (
            <>
              Joined your staff{at} in {year}
            </>
          );
      } else if (latest?.ongoing) {
        const since = latest.start ? (
          <>
            {" "}
            since <Since mark={latest.start} />
          </>
        ) : null;
        body =
          ctx.relation === "mentor" ? (
            <>
              Your head coach{at}
              {since}
            </>
          ) : ctx.relation === "mentee" ? (
            latest.start ? (
              <>
                On your staff{at}
                {since}
              </>
            ) : (
              <>On your current staff{at}</>
            )
          ) : latest.start ? (
            <>
              On staff with you{at}
              {since}
            </>
          ) : (
            <>On the current staff with you{at}</>
          );
      } else {
        const lead = ctx.relation === "mentor" ? `You worked under ${firstName}` : ctx.relation === "mentee" ? "Coached under you" : "Worked alongside you";
        body = (
          <>
            {lead}
            {at}
            <PastYears runs={ctx.runs} />
          </>
        );
      }
      break;
    }
    case "mentees":
      body = (
        <>
          <span className="num">{ctx.count.toLocaleString("en-US")}</span> coached under {firstName}
        </>
      );
      break;
  }
  return <ContextLine icon={Network}>{body}</ContextLine>;
}

/** Whether the line shows a dotted year (the page then explains the mark once, §6.2). */
export function contextInferred(ctx: TreeContext | undefined): boolean {
  if (!ctx || ctx.kind === "mentees") return false;
  const latest = ctx.runs[ctx.runs.length - 1];
  // An ongoing line shows only the latest run's start ("since 2020").
  if (ctx.kind === "workedAt" ? ctx.current : latest?.ongoing) return !!latest?.start?.inferred;
  return inferredYears(ctx.runs.filter(shown)).length > 0;
}
