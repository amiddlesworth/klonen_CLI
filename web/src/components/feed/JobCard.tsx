/**
 * The feed's job card is the shared JobCard (components/jobs/JobCard.tsx, feed layout), wrapped in
 * the feed item card by FeedJobCard: one component for the feed, /jobs, the program Jobs tab and the
 * post-job preview (audit X03). Kept as a re-export so the feed page's import stays unchanged.
 */
export { FeedJobCard as JobCard } from "@/components/jobs/FeedJobCard";
