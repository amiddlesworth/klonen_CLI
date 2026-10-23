import { Card } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/TextLink";
import { SectionHeader } from "./SectionHeader";

const STEPS = [
  {
    title: "Built from public sources",
    body: "We read athletics staff pages and coach bios. Every stint keeps the sentence it came from, and years a bio implies but doesn't state are marked as inferred.",
    link: { href: "/about#data-sources", label: "How the data is sourced" },
  },
  {
    title: "Coaches claim and correct",
    body: "A coach finds their profile, confirms a school email and reviews each stint before publishing. Until then the profile says it is unclaimed.",
    link: { href: "/search", label: "Find your profile" },
  },
  {
    title: "Programs hire",
    body: "Athletic directors post openings and search for candidates by role, conference and coaching tree during the hiring carousel.",
    link: { href: "/jobs", label: "Browse jobs" },
  },
];

/**
 * How it works: three numbered steps in one card, split by dividers (columns from lg, stacked
 * below). The list is an <ol>; the ink number discs are decorative.
 */
export function HowItWorks() {
  return (
    <section aria-labelledby="how-title">
      <SectionHeader id="how-title" title="How it works" />
      <Card>
        <ol className="grid lg:grid-cols-3">
          {STEPS.map((s, i) => (
            // Below lg: the disc sits left of the text column (24 + 12); from lg it sits above the title.
            <li
              key={s.title}
              className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 p-4 md:px-6 md:py-5 lg:flex lg:flex-col [&+&]:border-t [&+&]:border-divider lg:[&+&]:border-l lg:[&+&]:border-t-0"
            >
              <span aria-hidden="true" className="num mt-[-2px] grid size-6 place-items-center rounded-full bg-fg-1 text-caption font-semibold text-surface lg:mt-0">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col lg:mt-3">
                <h3 className="text-body font-semibold">{s.title}</h3>
                <p className="mt-1 max-w-prose text-small text-fg-2">{s.body}</p>
                <TextLink href={s.link.href} arrow target24 className="mt-3 self-start text-small">
                  {s.link.label}
                </TextLink>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
