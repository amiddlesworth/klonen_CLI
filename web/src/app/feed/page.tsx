import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Briefcase, Repeat } from "lucide-react";
import { CarouselTracker, PhoneTrackerSummary } from "@/components/feed/CarouselTracker";
import { FeedPageNote, FeedToolbar } from "@/components/feed/FeedToolbar";
import { GroupCard } from "@/components/feed/GroupCard";
import { JobCard } from "@/components/feed/JobCard";
import { MeMenuStats, MiniProfile, Shortcuts, shortcutsFor } from "@/components/feed/MiniProfile";
import { MoveCard } from "@/components/feed/MoveCard";
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
  getCarouselTracker,
  getFeedPage,
  getFeedViewer,
  getMiniProfileStats,
  getPeopleYouMayKnow,
  parseFilter,
  parsePage,
  type FeedEntry,
  type FeedFilter,
} from "@/lib/queries/feedx";
import { getSession } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTER_TITLE: Record<FeedFilter, string> = { all: "Home", moves: "Staff moves", jobs: "Jobs in your feed" };

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const page = parsePage(sp.page);
  return {
    title: page > 1 ? `${FILTER_TITLE[filter]} · Page ${page}` : FILTER_TITLE[filter],
    description: `Hires, promotions and jobs across Division III football for the ${CURRENT_SEASON} season.`,
    robots: { index: false, follow: false },
  };
}

function feedHref(filter: FeedFilter, page = 1): string {
  const q = new URLSearchParams();
  if (filter !== "all") q.set("filter", filter);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/feed?${s}` : "/feed";
}

function entryInferred(e: FeedEntry): boolean {
  if (e.type === "move") return e.move.recordInferred;
  if (e.type === "group") return e.moves.slice(0, 5).some((m) => m.previousInferred);
  return false;
}

/**
 * Home feed (DESIGN.md §8.5, design/reference/feed.html). Signed-in only: visitors go to the landing
 * page. Left rail: mini profile and shortcuts (lg; in the Me menu at md). Center: filter, moves with
 * personal reasons from the session, a sample job, and the "More staff moves" digest, paginated by
 * ?page=. Right rail: carousel tracker and people you may know.
 */
export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  if (!session) redirect("/");
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);
  const page = parsePage(sp.page);

  const viewer = await getFeedViewer(session);
  const [shellViewer, feed, tracker, pymk, stats] = await Promise.all([
    getViewer(session),
    getFeedPage(viewer, filter, page),
    getCarouselTracker(viewer),
    getPeopleYouMayKnow(viewer),
    getMiniProfileStats(viewer),
  ]);
  if (page > feed.totalPages) notFound();

  const status = shellViewer.availability ? availabilityStatus(shellViewer.availability.open, shellViewer.availability.audience, shellViewer.orgShortName) : null;
  const shortcuts = shortcutsFor(viewer, stats);
  const lite = { name: viewer.name, tintKey: viewer.tintKey };
  const nextHref = page < feed.totalPages ? feedHref(filter, page + 1) : null;

  // The dotted-year footnote goes in the first card on the page that shows an inferred year (§6.2).
  const noteIndex = feed.entries.findIndex(entryInferred);
  const digestNote = noteIndex < 0 && feed.digest.some((m) => m.previousInferred);

  const empty = filter === "jobs" ? feed.totalJobs === 0 : filter === "moves" ? feed.totalMoves === 0 : feed.totalMoves + feed.totalJobs === 0;
  const noun = filter === "jobs" ? "jobs" : filter === "moves" ? "moves" : "moves or jobs";

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
          <CarouselTracker tracker={tracker} />
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
      {page > 1 && <FeedPageNote page={page} totalPages={feed.totalPages} topHref={feedHref(filter)} />}
      {page === 1 && filter !== "jobs" && !empty && <PhoneTrackerSummary tracker={tracker} />}

      {empty ? (
        <Card padding="main">
          <EmptyState
            icon={filter === "jobs" ? Briefcase : Repeat}
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
            if (e.type === "job") return <JobCard key={e.key} job={e.job} />;
            if (e.type === "group")
              return <GroupCard key={e.key} org={e.org} moves={e.moves} reason={e.reason} sourceUrl={e.sourceUrl} viewer={lite} showInferredNote={note} />;
            return <MoveCard key={e.key} move={e.move} reason={e.reason} viewer={lite} showInferredNote={note} />;
          })}
          <TransactionsDigest moves={feed.digest} moreHref={nextHref} showInferredNote={digestNote} />
          {nextHref && (filter === "jobs" || feed.digest.length === 0) && (
            <div className="max-md:px-4">
              <ButtonLink href={nextHref} fullWidth phone="large">
                {filter === "jobs" ? "Show more jobs" : "Show more moves"}
              </ButtonLink>
            </div>
          )}
          {!nextHref && <p className="py-4 text-center text-caption text-fg-3">You&apos;re up to date</p>}
        </>
      )}
    </ThreeColumnLayout>
  );
}
