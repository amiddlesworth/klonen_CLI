import Link from "next/link";
import { Users } from "lucide-react";
import { TwoColumnLayout } from "@/components/shell/Layouts";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { BRAND } from "@/lib/brand";
import { getProgramAlumni, getProgramPlayers, type ProgramCounts, type ProgramOrg } from "@/lib/queries/program";
import { ALUMNI_PAGE_SIZE, AlumniList } from "./AlumniList";
import { rangeHasInferred } from "./LedgerRange";
import { ProgramHeader } from "./ProgramHeader";
import { ProgramJsonLd } from "./ProgramJsonLd";
import { WhereNowCard } from "./ProgramRail";

const KIND_NOUN: Record<ProgramOrg["kind"], string> = {
  college: "college",
  high_school: "high school",
  pro: "team",
  other: "organization",
};

/**
 * Lighter page for an organization outside the program registry (another college, a high school, a
 * pro team): the header with what we know, then the coaches who worked or played there and where
 * they coach now. No tabs, Follow or jobs.
 */
export async function LightOrgPage({ org, counts, page, url, origin }: { org: ProgramOrg; counts: ProgramCounts; page: number; url: string; origin: string }) {
  const [alumni, players] = await Promise.all([getProgramAlumni(org.id), getProgramPlayers(org.id)]);
  const noun = KIND_NOUN[org.kind];
  const stats = [
    { value: counts.coached, label: "Coached here" },
    { value: counts.played, label: "Played here" },
  ];
  const base = `/programs/${org.slug}`;

  return (
    <TwoColumnLayout railLabel={`More about ${org.shortName}`} rail={<WhereNowCard entries={[...alumni, ...players]} />}>
      <ProgramJsonLd org={org} url={url} origin={origin} />
      <ProgramHeader
        org={org}
        stats={stats}
        note={
          <>
            This {noun} appears in the careers of coaches on {BRAND.name}. Full program pages with staff and jobs cover{" "}
            <Link href="/search?type=programs" className="font-medium text-link underline decoration-1 underline-offset-2 hover:decoration-2">
              NCAA Division III football programs
            </Link>{" "}
            for now.
          </>
        }
      />
      {!alumni.length && !players.length ? (
        <Card padding="main" aria-labelledby="coaches-empty-title">
          <CardHeader id="coaches-empty-title" title="Coaches" />
          <EmptyState icon={Users} title={`No coaches linked to ${org.shortName} yet.`} description="Coaches who worked or played here show up as their bios are added." spacing="lg" />
        </Card>
      ) : (
        <>
          <AlumniList
            id="coached"
            title="Coached here"
            subtitle={`Worked at ${org.shortName}, most recent first`}
            entries={alumni}
            kind="coached"
            page={page}
            hrefForPage={(p) => (p > 1 ? `${base}?page=${p}` : base)}
          />
          <AlumniList
            id="played"
            title="Played here"
            subtitle={`Played at ${org.shortName}, now coaching`}
            entries={players}
            kind="played"
            explainInferred={!alumni.slice((page - 1) * ALUMNI_PAGE_SIZE, page * ALUMNI_PAGE_SIZE).some((e) => rangeHasInferred(e.stints))}
          />
        </>
      )}
    </TwoColumnLayout>
  );
}
