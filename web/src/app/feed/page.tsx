import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Briefcase, Flag, Repeat } from "lucide-react";
import { CarouselTracker, PhoneTrackerSummary } from "@/components/feed/CarouselTracker";
import type { HideKind } from "@/components/feed/feedPrefs";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { FeedKindNote, FeedPageNote, FeedToolbar } from "@/components/feed/FeedToolbar";
import { GroupCard } from "@/components/feed/GroupCard";
import { JobCard } from "@/components/feed/JobCard";
import { MilestoneCard, milestoneInferred } from "@/components/feed/MilestoneCard";
import { MeMenuStats, MiniProfile, Shortcuts, shortcutsFor } from "@/components/feed/MiniProfile";
import { MOVE_HIDE_KIND, MoveCard } from "@/components/feed/MoveCard";
import { PeopleYouMayKnow } from "@/components/feed/PeopleYouMayKnow";
import { TransactionsDigest } from "@/components/feed/TransactionsDigest";
import { ThreeColumnLayout } from "@/components/shell/Layouts";
import { MeMenuSummary } from "@/components/shell/MeMenuSummary";
import { getViewer } from "@/components/shell/viewer";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CURRENT_SEASON } from "@/lib/brand";
import { availabilityStatus } from "@/lib/format";
import {
  formerStaffStint,
  getCarouselTracker,
  getFeedJobs,
  getFeedPage,
  getFeedTotalPages,
  getFeedViewer,
  getFollowedPrograms,
  getMiniProfileStats,
  getPeopleYouMayKnow,
  parseFilter,
  parseMoveKind,
  parsePage,
  type FeedEntry,
  type FeedFilter,
  type MoveFilterKind,
} from "@/lib/queries/feedx";
import { getSession, type Session } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTER_TITLE: Record<FeedFilter, string> = { all: "Home", moves: "Staff moves", jobs: "Jobs in your feed", milestones: "Milestones" };

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const page = parsePage(sp.page);
  return {
    title: page > 1 ? `${FILTER_TITLE[filter]} · Page ${page}` : FILTER_TITLE[filter],
    description: `Hires, promotions, milestones and jobs across Division III football for the ${CURRENT_SEASON} season.`,
    robots: { index: false, follow: false },
  };
}

function feedHref(filter: FeedFilter, page = 1, kind: MoveFilterKind | null = null): string {
  const q = new URLSearchParams();
  if (filter !== "all") q.set("filter", filter);
  if (kind) q.set("kind", kind);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/feed?${s}` : "/feed";
}

function entryInferred(e: FeedEntry, viewerOrgId: string | null): boolean {
  if (e.type === "move") {
    const facts = formerStaffStint(e.move, e.reason, viewerOrgId);
    return e.move.recordInferred || (!!facts && facts.inferred && facts.startYear !== null);
  }
  if (e.type === "group") return e.moves.slice(0, 5).some((m) => m.previousInferred);
  if (e.type === "milestone") return milestoneInferred(e.milestone);
  return false;
}

function entryHideKind(e: FeedEntry): HideKind | null {
  if (e.type === "move") return MOVE_HIDE_KIND[e.move.kind];
  if (e.type === "group") return "hire";
  if (e.type === "milestone") return "milestone";
  return null;
}

/**
 * Home feed (DESIGN.md §8.5, design/reference/feed.html). Signed-in only: visitors go to the landing
 * page. Left rail: mini profile and shortcuts (lg; in the Me menu at md). Center: filter, moves with
 * personal reasons from the session, a milestone, a sample job, and the "More staff moves" digest,
 * paginated by ?page=. Right rail: carousel tracker and people you may know.
 *
 * Only the bounds check runs before the Suspense boundary (pages after the first; it reads the
 * cached lists), so a page past the end is still a real 404 while every other request shows the
 * skeleton within one round trip and streams the feed in behind it.
 */
export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/");
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const page = parsePage(sp.page);
  const kind = filter === "moves" ? parseMoveKind(sp.kind) : null;

  if (page > 1) {
    const viewer = await getFeedViewer(session);
    if (page > (await getFeedTotalPages(viewer, filter, kind))) notFound();
  }

  return (
    <Suspense key={feedHref(filter, page, kind)} fallback={<FeedSkeleton filter={filter} />}>
      <FeedView session={session} filter={filter} page={page} kind={kind} />
    </Suspense>
  );
}

type FeedViewProps = { session: NonNullable<Session>; filter: FeedFilter; page: number; kind: MoveFilterKind | null };

/** The feed with its rails: everything here loads behind the skeleton. */
async function FeedView({ session, filter, page, kind }: FeedViewProps) {
  const viewer = await getFeedViewer(session);
  const [feed, shellViewer, tracker, pymk, stats, followed, openJobs] = await Promise.all([
    getFeedPage(viewer, filter, page, kind),
    getViewer(session),
    getCarouselTracker(viewer),
    getPeopleYouMayKnow(viewer),
    getMiniProfileStats(viewer),
    getFollowedPrograms(session.user.id),
    getFeedJobs(viewer),
  ]);

  const status = shellViewer.availability ? availabilityStatus(shellViewer.availability.open, shellViewer.availability.audience, shellViewer.orgShortName) : null;
  const shortcuts = shortcutsFor(
    viewer,
    stats,
    followed,
    openJobs.map((j) => ({ id: j.id, title: j.title, orgShortName: j.org.shortName })),
  );
  const lite = { name: viewer.name, tintKey: viewer.tintKey };
  const nextHref = page < feed.totalPages ? feedHref(filter, page + 1, kind) : null;

  // The dotted-year footnote goes in the first card on the page that shows an inferred year (§6.2).
  const viewerOrgId = viewer.org?.id ?? null;
  const noteIndex = feed.entries.findIndex((e) => entryInferred(e, viewerOrgId));
  const digestNote = noteIndex < 0 && feed.digest.some((m) => m.previousInferred);
  // The first item of each kind holds the placeholder when the viewer hides that kind.
  const firstOfKind = new Set<number>();
  const seenKinds = new Set<HideKind>();
  feed.entries.forEach((e, i) => {
    const k = entryHideKind(e);
    if (k && !seenKinds.has(k)) {
      seenKinds.add(k);
      firstOfKind.add(i);
    }
  });

  const empty = feed.total === 0;
  const noun =
    filter === "jobs"
      ? "jobs"
      : filter === "milestones"
        ? "milestones"
        : filter === "moves"
          ? kind === "hires"
            ? "hires"
            : kind === "promotions"
              ? "promotions"
              : kind === "other"
                ? "other role changes"
                : "moves"
          : "moves, milestones or jobs";
  // Phone: the rail sits below the feed, so the Moves list (where the phone summary leads) opens with the full tracker.
  const trackerView = filter === "moves" && page === 1;

  return (
    <ThreeColumnLayout
      left={
        <>
          <MiniProfile viewer={viewer} stats={stats} status={status} />
          <Shortcuts items={shortcuts} />
        </>
      }
      leftLabel="Your profile"
      right={
        <>
          <CarouselTracker tracker={tracker} className={trackerView ? "max-md:hidden" : undefined} />
          <PeopleYouMayKnow rows={pymk} />
        </>
      }
      rightLabel="Carousel and suggestions"
    >
      <MeMenuSummary>
        <MeMenuStats viewer={viewer} stats={stats} shortcuts={shortcuts} />
      </MeMenuSummary>
      <h1 className="sr-only">Home feed</h1>
      <FeedToolbar filter={filter} />
      {feed.kind && <FeedKindNote kind={feed.kind} />}
      {page > 1 && <FeedPageNote page={page} totalPages={feed.totalPages} topHref={feedHref(filter, 1, kind)} />}
      {page === 1 && filter === "all" && !empty && <PhoneTrackerSummary tracker={tracker} />}
      {trackerView && <CarouselTracker tracker={tracker} idPrefix="top-" className="md:hidden" />}

      {empty ? (
        <Card padding="main">
          <EmptyState
            icon={filter === "jobs" ? Briefcase : filter === "milestones" ? Flag : Repeat}
            title={`No ${noun} in Division III for ${CURRENT_SEASON} yet.`}
            description={`New ${noun} show up here first.`}
            action={
              filter !== "all" ? (
                <ButtonLink href="/feed" phone="large">
                  Clear filter
                </ButtonLink>
              ) : undefined
            }
            spacing="lg"
          />
        </Card>
      ) : (
        <>
          {feed.entries.map((e, i) => {
            const note = i === noteIndex;
            const first = firstOfKind.has(i);
            if (e.type === "job") return <JobCard key={e.key} job={e.job} />;
            if (e.type === "group")
              return <GroupCard key={e.key} org={e.org} moves={e.moves} reason={e.reason} sourceUrl={e.sourceUrl} viewer={lite} showInferredNote={note} firstOfKind={first} />;
            if (e.type === "milestone") return <MilestoneCard key={e.key} milestone={e.milestone} reason={e.reason} viewer={lite} showInferredNote={note} firstOfKind={first} />;
            return <MoveCard key={e.key} move={e.move} reason={e.reason} viewer={lite} viewerOrgId={viewerOrgId} showInferredNote={note} firstOfKind={first} />;
          })}
          <TransactionsDigest moves={feed.digest} moreHref={nextHref} showInferredNote={digestNote} />
          {nextHref && feed.digest.length === 0 && (
            <div className="max-md:px-4">
              <ButtonLink href={nextHref} fullWidth phone="large">
                {filter === "jobs" ? "Show more jobs" : filter === "milestones" ? "Show more milestones" : "Show more moves"}
              </ButtonLink>
            </div>
          )}
          {!nextHref && <p className="py-4 text-center text-caption text-fg-3">You&apos;re up to date</p>}
        </>
      )}
    </ThreeColumnLayout>
  );
}
