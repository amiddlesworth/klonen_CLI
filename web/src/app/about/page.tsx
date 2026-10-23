import type { Metadata } from "next";
import { SingleColumnLayout } from "@/components/shell/Layouts";
import { Card } from "@/components/ui/Card";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "About" };

const SECTIONS = [
  {
    id: "data-sources",
    title: "Data sources",
    body: [
      "Programs come from the NCAA directory of Division III football programs. Coaches and their coaching stints are read from public athletics staff pages and staff bios.",
      "Every stint keeps the sentence it came from and a link to the page. Years that a bio implies but does not state are marked as inferred. Profiles that a coach has not claimed say so, and coaches can claim and correct them.",
    ],
  },
  {
    id: "accessibility",
    title: "Accessibility",
    body: [
      "The product targets WCAG 2.1 AA: visible focus, labelled controls, text equivalents for charts, 44px touch targets on phones and color contrast checked in the light and dark themes.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy",
    body: [
      "“Open to opportunities” is never shown on a public profile. Sign-in is a demo: you choose a demo account from the Me menu, and the choice is kept in a cookie on this device.",
    ],
  },
  {
    id: "terms",
    title: "Terms",
    body: [
      "This is a demo. Sample job listings, demo messages and demo accounts are labeled where they appear and are not real. Coach information is shown as published by the programs, with a link to each source.",
    ],
  },
];

export default function AboutPage() {
  return (
    <SingleColumnLayout>
      <Card padding="main">
        <h1 className="text-display max-md:text-display-sm">About {BRAND.name}</h1>
        <p className="mt-2 max-w-prose text-prose text-fg-2">{BRAND.description}</p>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="mt-6 scroll-mt-20 border-t border-divider pt-5">
            <h2 id={`${s.id}-title`} className="text-title">
              {s.title}
            </h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 max-w-prose text-prose text-fg-1">
                {p}
              </p>
            ))}
          </section>
        ))}
      </Card>
    </SingleColumnLayout>
  );
}
