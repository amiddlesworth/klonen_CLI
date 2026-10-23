import { FeedArticle } from "@/components/feed/FeedArticle";
import type { FeedJob } from "@/lib/queries/feedx";
import { JobCard, type JobProof } from "./JobCard";

/** "Your colleagues John Bates and Nic Brockhoff played here" (no pronouns; the verb covers everyone counted). */
function networkSentence(net: NonNullable<FeedJob["network"]>): string {
  const names = net.people.map((p) => p.fullName);
  const others = net.total - names.length;
  const list =
    others > 0 ? `${names.join(", ")} and ${others} ${others === 1 ? "other" : "others"}` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `Your ${net.total === 1 ? "colleague" : "colleagues"} ${list} ${net.verb} here`;
}

/** The personal reason after "Job" in the meta line, from the session (§8.5): position group, own program, own conference. */
function reasonFor(job: FeedJob): string | null {
  if (job.matchesPosition) return "Matches your position group";
  if (job.atViewerProgram) return `${job.org.shortName} · your program`;
  if (job.inViewerConference && job.org.conferenceAbbr) return `${job.org.conferenceAbbr} · your conference`;
  return null;
}

/**
 * A job in the home feed: the shared JobCard (feed layout) inside the feed item card, so the feed,
 * /jobs, the program Jobs tab and the post-job preview all render one component (audit X03).
 */
export function FeedJobCard({ job }: { job: FeedJob }) {
  const headingId = `fi-j-${job.id}`;
  const proof: JobProof | null = job.network ? { people: job.network.people.map((p) => ({ name: p.fullName, slug: p.slug })), sentence: networkSentence(job.network) } : null;
  return (
    <FeedArticle labelledBy={headingId}>
      <JobCard
        layout="feed"
        headingId={headingId}
        job={{
          id: job.id,
          title: job.title,
          roleGroup: job.roleGroup,
          employmentType: job.employmentType,
          source: job.source,
          isDemo: job.isDemo,
          org: job.org,
        }}
        href={`/jobs/${job.id}`}
        meta={reasonFor(job)}
        proof={proof}
      />
    </FeedArticle>
  );
}
