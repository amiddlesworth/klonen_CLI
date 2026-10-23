import { pool } from "../src/db";
import { getProfile, getTree, getRelated } from "../src/lib/queries/people";
import { getOrg, getStaff, getAlumni } from "../src/lib/queries/orgs";
import { searchPeople, typeahead, facetOptions } from "../src/lib/queries/search";
import { getFeed, getCarouselStats, getDatasetStats } from "../src/lib/queries/feed";
import { listJobs } from "../src/lib/queries/jobs";

async function main() {
  const p = await getProfile(process.argv[2] ?? "bill-khayat");
  console.log("profile", p?.person.fullName, p?.stats, p?.experience.map((g) => `${g.org.shortName} ${g.startYear}-${g.endYear ?? "now"} (${g.roles.length})`).slice(0, 4));
  const t = await getTree(p!.person.id);
  console.log("tree", { mentors: t.mentors.length, mentees: t.mentees.length, peers: t.peers.length }, t.mentees.slice(0, 2).map((m) => m.person.fullName));
  console.log("related", (await getRelated(p!.person.id)).map((r) => r.fullName));
  const org = await getOrg("brevard");
  console.log("org", org?.name, (await getStaff(org!.id)).map((g) => `${g.unit}:${g.people.length}`), "alumni", (await getAlumni(org!.id)).length);
  console.log("search", (await searchPeople({ q: "coordinator" })).total, (await searchPeople({ roleGroup: "head_coach" })).total);
  console.log("typeahead", (await typeahead("mi")).people.length);
  console.log("facets", await facetOptions());
  const feed = await getFeed();
  console.log("feed", feed.length, feed.slice(0, 3).map((f) => (f.type === "move" ? `${f.move.kind}: ${f.move.person.fullName} → ${f.move.org.shortName}` : `job: ${f.job.title}`)));
  console.log("carousel", await getCarouselStats());
  console.log("dataset", await getDatasetStats());
  console.log("jobs", (await listJobs()).length);
  await pool.end();
}
main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
