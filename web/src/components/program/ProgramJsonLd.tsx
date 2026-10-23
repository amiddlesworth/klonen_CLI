import type { ProgramOrg } from "@/lib/queries/program";
import type { PersonSummary } from "@/lib/queries/people";

type ProgramJsonLdProps = {
  org: ProgramOrg;
  /** Absolute URL of this page. */
  url: string;
  /** Absolute origin, for coach profile URLs. */
  origin: string;
  /** Head coach(es) on staff (registry programs). */
  headCoaches?: PersonSummary[];
};

/**
 * Structured data: a registry program is a SportsTeam (American football) whose parent organization
 * is a CollegeOrUniversity; other organizations are typed by kind (CollegeOrUniversity, HighSchool,
 * SportsTeam for pro teams, Organization otherwise). Only structured facts we hold; no prose.
 */
export function ProgramJsonLd({ org, url, origin, headCoaches = [] }: ProgramJsonLdProps) {
  const address = org.state ? { "@type": "PostalAddress", addressRegion: org.state, ...(org.city ? { addressLocality: org.city } : {}), addressCountry: "US" } : undefined;
  const sameAs = org.athleticsUrl ? [org.athleticsUrl] : undefined;

  let data: Record<string, unknown>;
  if (org.inRegistry) {
    data = {
      "@context": "https://schema.org",
      "@type": "SportsTeam",
      name: [org.name, org.nickname].filter(Boolean).join(" ") + " football",
      alternateName: org.shortName,
      sport: "American football",
      url,
      sameAs,
      ...(org.conference ? { memberOf: { "@type": "SportsOrganization", name: org.conference } } : {}),
      parentOrganization: { "@type": "CollegeOrUniversity", name: org.name, address },
      ...(headCoaches.length
        ? {
            coach: headCoaches.map((p) => ({
              "@type": "Person",
              name: p.fullName,
              ...(p.currentTitle ? { jobTitle: p.currentTitle } : {}),
              url: `${origin}/in/${p.slug}`,
            })),
          }
        : {}),
    };
  } else {
    const type = org.kind === "college" ? "CollegeOrUniversity" : org.kind === "high_school" ? "HighSchool" : org.kind === "pro" ? "SportsTeam" : "Organization";
    data = {
      "@context": "https://schema.org",
      "@type": type,
      name: org.name,
      ...(org.shortName !== org.name ? { alternateName: org.shortName } : {}),
      ...(type === "SportsTeam" ? { sport: "American football" } : {}),
      url,
      sameAs,
      address,
    };
  }

  // Escape "<" so a value can never close the script element.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
