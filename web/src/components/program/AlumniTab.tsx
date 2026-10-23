import { GraduationCap } from "lucide-react";
import { getProgramAlumni, getProgramPlayers, type ProgramOrg } from "@/lib/queries/program";
import { ALUMNI_PAGE_SIZE, AlumniList } from "./AlumniList";

/**
 * Alumni coaches tab (§8.6): people who coached here and where they are now, most recent first,
 * then former players who now coach ("Played here", the full list behind the rail's "Coaches from
 * here"). The tab count is the Alumni coaches list.
 */
export async function AlumniTab({ org, page }: { org: ProgramOrg; page: number }) {
  const [alumni, players] = await Promise.all([getProgramAlumni(org.id), getProgramPlayers(org.id)]);
  const base = `/programs/${org.slug}?tab=alumni`;
  return (
    <>
      <AlumniList
        id="alumni"
        title="Alumni coaches"
        subtitle={`Coached at ${org.shortName} before their current job`}
        entries={alumni}
        kind="coached"
        page={page}
        hrefForPage={(p) => (p > 1 ? `${base}&page=${p}` : base)}
        empty={{
          icon: GraduationCap,
          title: `No alumni coaches for ${org.shortName} yet.`,
          description: "Coaches who worked here show up as their bios are added.",
        }}
      />
      <AlumniList
        id="played"
        title="Played here"
        subtitle={`Former ${org.shortName} players who now coach`}
        entries={players}
        kind="played"
        explainInferred={!alumni.slice((page - 1) * ALUMNI_PAGE_SIZE, page * ALUMNI_PAGE_SIZE).some((e) => e.inferred)}
      />
    </>
  );
}
