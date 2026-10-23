import type { ReactNode } from "react";
import {
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  ChevronsUp,
  Ellipsis,
  ExternalLink,
  Flag,
  Forward,
  GraduationCap,
  Handshake,
  House,
  Info,
  LayoutGrid,
  Lock,
  LogIn,
  Mail,
  MessageCircle,
  MessageSquare,
  Network,
  Plus,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ConferenceBadge, DemoFootnote, DemoLabel, LevelBadge, ProgramBadges } from "@/components/data/Badges";
import { ContextLine } from "@/components/data/ContextLine";
import { InferredFootnote, InferredYear } from "@/components/data/InferredYear";
import { PersonRow } from "@/components/data/PersonRow";
import { QuoteBlock } from "@/components/data/QuoteBlock";
import { SeasonRange } from "@/components/data/SeasonRange";
import { SeasonStrip, type StripStint } from "@/components/data/SeasonStrip";
import { SectionCard } from "@/components/data/SectionCard";
import { SourceDisclosure } from "@/components/data/SourceDisclosure";
import { SourceLink } from "@/components/data/SourceLink";
import { StatGroup } from "@/components/data/StatGroup";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { BrandMark } from "@/components/shell/BrandMark";
import { LegalFooter } from "@/components/shell/LegalFooter";
import { MeMenuPreview } from "@/components/shell/MeMenu";
import { MobileTopBar } from "@/components/shell/MobileTopBar";
import { NAV_ITEM, NavIcon } from "@/components/shell/NavItem";
import { TopNav } from "@/components/shell/TopNav";
import { typeaheadOptions, type TypeaheadResponse } from "@/components/shell/typeahead";
import { TypeaheadPanel } from "@/components/shell/TypeaheadPanel";
import type { DemoAccountOption, Viewer } from "@/components/shell/types";
import { Avatar, type AvatarSize } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { Checkbox, ChoiceGroup, Radio, Switch } from "@/components/ui/Checkbox";
import { Chip, SampleChip, UnclaimedChip } from "@/components/ui/Chip";
import { CountBadge } from "@/components/ui/CountBadge";
import { DialogPanel } from "@/components/ui/Dialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { Divider } from "@/components/ui/Divider";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { AppliedFilterChip, FilterChip } from "@/components/ui/FilterChip";
import { Icon, type IconSize } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { MenuSurface } from "@/components/ui/Menu";
import { MenuDivider, MenuItem } from "@/components/ui/MenuItems";
import { OrgMark, type OrgMarkSize } from "@/components/ui/OrgMark";
import { Pagination, ShowMore } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import { Select } from "@/components/ui/Select";
import { Skeleton, SkeletonAvatar, SkeletonRegion, SkeletonRows, SkeletonText, SkeletonTile } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { TextLink } from "@/components/ui/TextLink";
import { Textarea } from "@/components/ui/Textarea";
import { ToastCard } from "@/components/ui/Toast";
import { TOOLTIP_BUBBLE } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import { tintFor, type Tint } from "@/lib/format";
import { LiveDialog, LiveLoadingButton, LiveMenu, LivePopover, LiveSegmented, LiveToast, LiveToggle } from "./Live";

/* ---------- layout helpers ---------- */

function Section({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <Card as="section" padding="main" aria-labelledby={`${id}-h`}>
      <CardHeader id={`${id}-h`} title={title} meta={note} />
      <div className="flex flex-col gap-6">{children}</div>
    </Card>
  );
}

/** A section shown on the canvas (no outer card), for specimens that are cards themselves (§5.3: no card in a card). */
function CanvasSection({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="py-2">
      <CardHeader id={`${id}-h`} title={title} meta={note} className="max-md:px-4" />
      {children}
    </section>
  );
}

function Group({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-small font-semibold text-fg-1">{title}</h3>
      {children}
    </div>
  );
}

function Spec({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-1.5", className)}>
      <span className="text-caption text-fg-3">{label}</span>
      {children}
    </div>
  );
}

function SpecRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-start gap-x-6 gap-y-4", className)}>{children}</div>;
}

/* ---------- sample data (fictional people; real program names) ---------- */

const SWATCHES: [string, string][] = [
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["hover", "bg-hover"],
  ["pressed", "bg-pressed"],
  ["border", "bg-border"],
  ["divider", "bg-divider"],
  ["border-strong", "bg-border-strong"],
  ["control", "bg-control"],
  ["fg-1", "bg-fg-1"],
  ["fg-2", "bg-fg-2"],
  ["fg-3", "bg-fg-3"],
  ["fg-disabled", "bg-fg-disabled"],
  ["accent", "bg-accent"],
  ["accent-hover", "bg-accent-hover"],
  ["accent-pressed", "bg-accent-pressed"],
  ["accent-subtle", "bg-accent-subtle"],
  ["on-accent", "bg-on-accent"],
  ["link", "bg-link"],
  ["focus", "bg-focus"],
  ["danger", "bg-danger"],
  ["danger-hover", "bg-danger-hover"],
  ["danger-pressed", "bg-danger-pressed"],
  ["danger-subtle", "bg-danger-subtle"],
  ["badge-bg", "bg-badge-bg"],
  ["badge-fg", "bg-badge-fg"],
  ["org-bg", "bg-org-bg"],
  ["org-fg", "bg-org-fg"],
  ["lvl-head", "bg-lvl-head"],
  ["lvl-coord", "bg-lvl-coord"],
  ["lvl-pos", "bg-lvl-pos"],
  ["bar", "bg-bar"],
  ["track", "bg-track"],
  ["overlay", "bg-overlay"],
];

const TYPE: [string, string, string][] = [
  ["text-hero", "Hero 36/44 · 600", "Coaching careers, season by season"],
  ["text-display", "Display 24/32 · 600", "Pacific University (Oregon)"],
  ["text-stat", "Stat 20/28 · 600", "25 seasons"],
  ["text-title", "Title 16/24 · 600", "Experience"],
  ["text-subtitle", "Subtitle 15/22", "Head Football Coach at Pacific (OR)"],
  ["text-body", "Body 14/20", "Joined the staff as offensive coordinator and quarterbacks coach"],
  ["text-prose", "Prose 14/22", "Quotes and paragraphs, up to 68 characters per line for comfortable reading."],
  ["text-small", "Small 13/18", "Meta lines, buttons, ranges and tree names"],
  ["text-caption", "Caption 12/16", "Durations, context lines, chips and footnotes"],
];

const ICONS: [string, LucideIcon][] = [
  ["Home", House],
  ["Network", Users],
  ["Jobs", Briefcase],
  ["Messaging", MessageSquare],
  ["Notifications", Bell],
  ["Search", Search],
  ["For employers", LayoutGrid],
  ["Coaching tree", Network],
  ["Alma mater", GraduationCap],
  ["New hire", LogIn],
  ["Promotion", ChevronsUp],
  ["Milestone", Flag],
  ["Info", Info],
  ["Save job", Bookmark],
  ["Congratulate", Handshake],
  ["Comment", MessageCircle],
  ["Message", Mail],
  ["Share", Forward],
  ["Follow", Plus],
  ["Connect", UserPlus],
  ["Invite to claim", Send],
  ["Claim", ShieldCheck],
  ["Source link", ExternalLink],
  ["Program", Building2],
  ["Private", Lock],
  ["More", Ellipsis],
];

const STRIP: StripStint[] = [
  { orgId: "wl", shortName: "West Linn HS", name: "West Linn High School", role: "Assistant offensive line coach", roleGroup: "position_coach", startYear: 2002, endYear: 2002, isCurrent: false },
  { orgId: "lc", shortName: "Lewis & Clark", name: "Lewis & Clark College", role: "Tight ends coach", roleGroup: "position_coach", startYear: 2003, endYear: 2003, isCurrent: false },
  { orgId: "ob", shortName: "Oberlin", name: "Oberlin College", role: "Offensive line coach", roleGroup: "position_coach", startYear: 2004, endYear: 2005, isCurrent: false },
  { orgId: "lc", shortName: "Lewis & Clark", name: "Lewis & Clark College", role: "Offensive coordinator", roleGroup: "coordinator", startYear: 2006, endYear: 2009, isCurrent: false },
  { orgId: "pu", shortName: "Pacific (OR)", name: "Pacific University (Oregon)", role: "Offensive line coach", roleGroup: "position_coach", startYear: 2010, endYear: 2019, isCurrent: false },
  { orgId: "pu", shortName: "Pacific (OR)", name: "Pacific University (Oregon)", role: "Head football coach", roleGroup: "head_coach", startYear: 2020, endYear: null, isCurrent: true },
];

const TYPEAHEAD: TypeaheadResponse = {
  people: [
    { slug: "sample-avery-falk", name: "Avery Falk", meta: "Head Football Coach · Pacific (OR)" },
    { slug: "sample-casey-falcone", name: "Casey Falcone", meta: "Defensive Line Coach · Coe" },
  ],
  programs: [{ slug: "fitchburg-state", name: "Fitchburg State University", shortName: "Fitchburg State", meta: "D-III · MASCAC" }],
};

/** The fictional viewer of the shell previews (the gallery never loads a live demo session). */
const FALLBACK_VIEWER: Viewer = {
  role: "coach",
  name: "Avery Falk",
  tintKey: "sample-avery-falk",
  profileSlug: null,
  // A fictional program too, so the preview never names someone as a real program's coach.
  title: "Defensive Backs Coach",
  orgShortName: "Sample College",
  orgSlug: null,
  availability: { open: false, audience: "all_except_current" },
};

/** One sample key per people tint, so all six tints show. */
function tintKeys(): Record<Tint, string> {
  const out: Partial<Record<Tint, string>> = {};
  for (let i = 0; Object.keys(out).length < 6 && i < 500; i++) {
    const k = `sample-${i}`;
    const t = tintFor(k);
    if (!out[t]) out[t] = k;
  }
  return out as Record<Tint, string>;
}

const STATES = [
  ["Default", undefined],
  ["Hover", "hover"],
  ["Active", "active"],
  ["Focus", "focus"],
] as const;

/* ---------- the gallery ---------- */

export function Specimens({ prefix, accounts, viewer: demoViewer }: { prefix: string; accounts: DemoAccountOption[]; viewer: Viewer | null }) {
  const id = (s: string) => `${prefix}-${s}`;
  // A fictional sample viewer: never a live demo session, whose private settings the Me menu would show.
  const viewer = demoViewer ?? FALLBACK_VIEWER;
  const keys = tintKeys();
  const options = typeaheadOptions(TYPEAHEAD, "fal");

  return (
    <div className="flex flex-col gap-3">
      <Section id={id("tokens")} title="Color tokens" note="§2.1">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="flex min-w-0 items-center gap-2">
              <span className={cn("size-8 shrink-0 rounded-sm shadow-[inset_0_0_0_1px_var(--border)]", cls)} />
              <span className="truncate text-caption text-fg-2">--{name}</span>
            </div>
          ))}
        </div>
        <Group title="People tints">
          <div className="flex flex-wrap gap-3">
            {([1, 2, 3, 4, 5, 6] as Tint[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-2 text-caption text-fg-2">
                <Avatar name={["Slate Sample", "Sage Sample", "Sand Sample", "Clay Sample", "Plum Sample", "Teal Sample"][t - 1]} tintKey={keys[t]} size={32} />c{t}
              </span>
            ))}
          </div>
        </Group>
      </Section>

      <Section id={id("type")} title="Typography" note="§4 · Inter, cv11, tabular numbers">
        <div className="flex flex-col gap-3">
          {TYPE.map(([cls, label, sample]) => (
            <div key={cls} className="grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:items-baseline md:gap-4">
              <span className="text-caption text-fg-3">{label}</span>
              <span className={cn(cls, "min-w-0", cls === "text-hero" && "max-md:text-hero-sm", cls === "text-display" && "max-md:text-display-sm")}>{sample}</span>
            </div>
          ))}
          <div className="grid gap-1 md:grid-cols-[180px_minmax(0,1fr)] md:items-baseline md:gap-4">
            <span className="text-caption text-fg-3">Numbers (num)</span>
            <span className="num text-small font-medium">2003, 2006–2009 · 2010–Present · 1,284</span>
          </div>
        </div>
      </Section>

      <Section id={id("icons")} title="Icons" note="§7 · Lucide outline">
        <SpecRow>
          {([12, 14, 16, 20, 22] as IconSize[]).map((s) => (
            <Spec key={s} label={`${s}px`}>
              <Icon icon={House} size={s} className="text-fg-1" />
            </Spec>
          ))}
        </SpecRow>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4 lg:grid-cols-6">
          {ICONS.map(([label, glyph]) => (
            <span key={label} className="flex items-center gap-2 text-small text-fg-2">
              <Icon icon={glyph} size={16} className="text-fg-1" />
              {label}
            </span>
          ))}
        </div>
      </Section>

      <Section id={id("buttons")} title="Buttons" note="§8.1 · one primary per view">
        {(["primary", "secondary", "ghost", "danger"] as const).map((v) => (
          <Group key={v} title={v[0].toUpperCase() + v.slice(1)}>
            <SpecRow>
              {STATES.map(([label, force]) => (
                <Spec key={label} label={label}>
                  <Button variant={v} icon={v === "primary" ? UserPlus : v === "secondary" ? Mail : v === "ghost" ? Handshake : undefined} data-force={force}>
                    {v === "primary" ? "Connect" : v === "secondary" ? "Message" : v === "ghost" ? "Congratulate" : "Remove"}
                  </Button>
                </Spec>
              ))}
              <Spec label="Disabled">
                <Button variant={v} disabled>
                  {v === "primary" ? "Connect" : "Unavailable"}
                </Button>
              </Spec>
              <Spec label="Loading">
                <Button variant={v} loading icon={v === "primary" ? UserPlus : undefined}>
                  {v === "primary" ? "Connect" : "Saving"}
                </Button>
              </Spec>
            </SpecRow>
          </Group>
        ))}
        <Group title="Sizes, icon-only, toggles and links">
          <SpecRow>
            <Spec label="sm 28">
              <Button size="sm" icon={ShieldCheck}>
                Claim profile
              </Button>
            </Spec>
            <Spec label="md 32">
              <Button icon={ShieldCheck}>Claim profile</Button>
            </Spec>
            <Spec label="Phone large (44)">
              <Button phone="large">View job</Button>
            </Spec>
            <Spec label="Icon (ghost / secondary / sm)">
              <span className="flex gap-2">
                <IconButton icon={Ellipsis} label="More options" />
                <IconButton icon={Bookmark} label="Save job" variant="secondary" />
                <IconButton icon={UserPlus} label="Connect with Avery Falk" variant="secondary" size="sm" />
              </span>
            </Spec>
            <Spec label="Icon hover / focus / disabled">
              <span className="flex gap-2">
                <IconButton icon={Ellipsis} label="More options" data-force="hover" tooltip={false} />
                <IconButton icon={Bookmark} label="Save job" variant="secondary" data-force="focus" tooltip={false} />
                <IconButton icon={Bookmark} label="Save job" variant="secondary" disabled tooltip={false} />
              </span>
            </Spec>
            <Spec label="Toggle pressed">
              <span className="flex gap-2">
                <Button pressed>Pending</Button>
                <IconButton icon={Bookmark} label="Saved" variant="secondary" pressed tooltip={false} />
              </span>
            </Spec>
            <Spec label="Live toggles">
              <LiveToggle />
            </Spec>
            <Spec label="Live loading">
              <LiveLoadingButton />
            </Spec>
            <Spec label="ButtonLink">
              <ButtonLink href="/jobs">View job</ButtonLink>
            </Spec>
            <Spec label="ButtonLink disabled">
              <ButtonLink href="/jobs" disabled>
                View job
              </ButtonLink>
            </Spec>
          </SpecRow>
        </Group>
      </Section>

      <Section id={id("links")} title="Links" note="§8.1 Link · SourceLink">
        <SpecRow>
          <Spec label="Default">
            <TextLink href="/feed">View program</TextLink>
          </Spec>
          <Spec label="Hover">
            <TextLink href="/feed" data-force="hover">
              View program
            </TextLink>
          </Spec>
          <Spec label="With arrow">
            <TextLink href="/feed" arrow>
              Explore tree
            </TextLink>
          </Spec>
          <Spec label="Plain name (24px target)">
            <TextLink href="/feed" variant="plain" target24 className="font-semibold">
              Avery Falk
            </TextLink>
          </Spec>
          <Spec label="Focus">
            <TextLink href="/feed" data-force="focus">
              View staff
            </TextLink>
          </Spec>
          <Spec label="SourceLink">
            <SourceLink href="https://goboxers.com/sports/football/roster" detail="staff bio" />
          </Spec>
        </SpecRow>
        <p className="max-w-prose text-prose">
          Inside prose, links are always underlined: read the{" "}
          <TextLink href="https://www.ncaa.org" variant="inline">
            NCAA directory
          </TextLink>{" "}
          for the full list of programs.
        </p>
      </Section>

      <Section id={id("chips")} title="Chips and badges" note="§8.1 Chip · CountBadge">
        <SpecRow>
          <Spec label="Neutral">
            <span className="flex gap-1">
              <Chip>D-III</Chip>
              <Chip>Position coach</Chip>
              <Chip className="num">2026</Chip>
            </span>
          </Spec>
          <Spec label="Abbreviation">
            <span className="flex gap-1">
              <Chip kind="abbr" title="Northwest Conference">
                NWC
              </Chip>
              <ConferenceBadge abbr="NEWMAC" name="New England Women's and Men's Athletic Conference" />
            </span>
          </Spec>
          <Spec label="Outline">
            <UnclaimedChip />
          </Spec>
          <Spec label="Sample (dashed)">
            <span className="flex gap-1">
              <DemoLabel kind="listing" />
              <DemoLabel />
              <SampleChip label="Sample" />
            </span>
          </Spec>
          <Spec label="LevelBadge + ConferenceBadge">
            <ProgramBadges level="NCAA D-III" conferenceAbbr="NWC" conference="Northwest Conference" />
          </Spec>
          <Spec label="High school / pro">
            <span className="flex gap-1">
              <LevelBadge level="high school" />
              <LevelBadge level="pro/semi-pro" />
            </span>
          </Spec>
          <Spec label="CountBadge">
            {/* The badge sits past the icon's right edge; pr-6 keeps "99+" clear of the next specimen. */}
            <span className="flex items-center gap-6 pr-6 pt-2 text-fg-2">
              <span className="relative grid">
                <Icon icon={Bell} size={20} />
                <CountBadge count={5} className="-top-1.5 left-3" />
              </span>
              <span className="relative grid">
                <Icon icon={MessageSquare} size={20} />
                <CountBadge count={128} className="-top-1.5 left-3" />
              </span>
            </span>
          </Spec>
          <Spec label="Kbd">
            <span className="flex gap-1">
              <Kbd>/</Kbd>
              <Kbd>↵</Kbd>
            </span>
          </Spec>
        </SpecRow>
        <DemoFootnote>Past 7 days</DemoFootnote>
      </Section>

      <Section id={id("identity")} title="Avatars and org marks" note="People are circles; organizations are rounded squares">
        <SpecRow>
          {([24, 28, 32, 36, 40, 48, 56, 64, 80] as AvatarSize[]).map((s) => (
            <Spec key={s} label={String(s)}>
              <Avatar name="Avery Falk" tintKey={keys[5]} size={s} />
            </Spec>
          ))}
          <Spec label="Unlisted">
            <Avatar name="Robin Hale" size={40} unlisted />
          </Spec>
        </SpecRow>
        <SpecRow>
          {([24, 32, 40, 48, 56] as OrgMarkSize[]).map((s) => (
            <Spec key={s} label={String(s)}>
              <OrgMark shortName="Pacific (OR)" name="Pacific University (Oregon)" size={s} />
            </Spec>
          ))}
          <Spec label="Acronym">
            <OrgMark shortName="MIT" size={40} />
          </Spec>
        </SpecRow>
      </Section>

      <CanvasSection id={id("cards")} title="Cards" note="Level 1: surface + 1px border, radius 8 · shown on the canvas">
        <div className="grid items-start gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
          <Card padding="rail">
            <CardHeader size="rail" title="People you may know" subtitle="Through your staff and schools" />
            <PersonRow
              className="mt-3"
              size="sm"
              avatarSize={36}
              name="Avery Falk"
              href="/feed"
              tintKey={keys[3]}
              title="Head Football Coach"
              org="Pacific (OR)"
              context={<ContextLine icon={GraduationCap}>Portland State alum, like you</ContextLine>}
              action={<IconButton icon={UserPlus} label="Connect with Avery Falk" variant="secondary" size="sm" />}
            />
            <CardFooter>
              <TextLink href="/feed" arrow>
                All suggestions
              </TextLink>
            </CardFooter>
          </Card>
          <Card padding="rail">
            <CardHeader size="rail" title="Carousel tracker" meta={<Chip className="num">2026</Chip>} subtitle="Division III · 14 programs with staff data" />
            <StatGroup
              variant="kpi"
              className="mt-3"
              stats={[
                { value: 20, label: "Hires", href: "/feed" },
                { value: 8, label: "Promotions", href: "/feed" },
                { value: 3, label: "Open jobs", href: "/jobs", adornment: <SampleChip label="Sample" className="h-[18px] px-1" /> },
              ]}
            />
            {/* The KPI strip's bottom divider doubles as the footer rule. */}
            <div className="pt-3">
              <TextLink href="/feed" arrow>
                All moves
              </TextLink>
            </div>
          </Card>
          <SectionCard id={id("sc-loading")} title="Experience" loading size="rail" />
          <SectionCard
            id={id("sc-empty")}
            title="Coaching tree"
            size="rail"
            empty={{ icon: Network, title: "No coaching tree yet.", description: "It fills in as coaches who worked with Avery are added.", action: <Button>Invite a colleague</Button> }}
          />
          <Card padding="rail" className="lg:col-span-2">
            <CardHeader
              title="Coaching tree"
              meta="7 people"
              action={
                <TextLink href="/feed" arrow>
                  Explore tree
                </TextLink>
              }
            />
            <p className="text-caption text-fg-3">
              7 people. Dana Ortiz and Eli Novak are listed twice because they worked alongside Avery before joining Avery&apos;s staff. Derived from overlapping seasons
              on the same staff.
            </p>
          </Card>
          <Card padding="rail" className="md:max-w-[280px]">
            <CardHeader size="rail" title="Same tree" subtitle="Two steps from Avery, through Avery's current staff" />
            <p className="text-caption text-fg-3">A rail header in a 280px tablet rail: the explanation is a subtitle, not a meta.</p>
          </Card>
          <Card padding="rail" className="md:max-w-[280px]">
            <CardHeader size="rail" title="Conference peers in the NWC" meta="9 programs" action={<TextLink href="/feed">View all</TextLink>} />
            <p className="text-caption text-fg-3">Header regression check: when the meta doesn&apos;t fit beside the title it wraps under it, left-aligned.</p>
          </Card>
        </div>
      </CanvasSection>

      <Section id={id("nav")} title="Tabs and segmented control" note="§8.1">
        <Spec label="Tabs (links, arrow keys)" className="w-full">
          <Tabs
            label="Program sections"
            className="w-full"
            items={[
              { href: "/dev/components?tab=staff", label: "Staff", count: 18, active: true },
              { href: "/dev/components?tab=alumni", label: "Alumni coaches", count: 7 },
              { href: "/dev/components?tab=jobs", label: "Jobs", count: 1 },
            ]}
          />
        </Spec>
        <SpecRow>
          <Spec label="Segmented (live)">
            <LiveSegmented />
          </Spec>
        </SpecRow>
      </Section>

      <Section id={id("forms")} title="Form controls" note="§8.1 Input · Checkbox · Switch · SearchField">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Input id={id("in-default")} label="School email" placeholder="you@school.edu" help="We send a 6-digit code." />
          <Input id={id("in-hover")} label="Hover" placeholder="you@school.edu" data-force="hover" />
          <Input id={id("in-focus")} label="Focus" defaultValue="avery@goboxers.com" data-force="focus" />
          <Input id={id("in-invalid")} label="Invalid" defaultValue="avery@" error="Enter a full email address." />
          <Input id={id("in-disabled")} label="Disabled" defaultValue="Pacific University (Oregon)" disabled />
          <Select
            id={id("sel")}
            label="Role group"
            placeholder="Any role"
            options={[
              { value: "head_coach", label: "Head coach" },
              { value: "coordinator", label: "Coordinator" },
              { value: "position_coach", label: "Position coach" },
            ]}
          />
          <Textarea id={id("ta")} label="Note" placeholder="Strong references from the head coach." className="md:col-span-1" />
          <ChoiceGroup label="Who can see it">
            <Radio name={id("aud")} label="Search firms" />
            <Radio name={id("aud")} label="All employers except my current program" defaultChecked />
            <Radio name={id("aud")} label="Specific programs" disabled />
          </ChoiceGroup>
          <div className="flex flex-col">
            <span className="mb-1 text-small font-semibold">Division</span>
            <Checkbox label="Division III" count={244} defaultChecked />
            <Checkbox label="Division II" count={0} />
            <Checkbox label="Disabled" disabled />
            <Switch label="Open to opportunities" description="Never shown on your public profile" defaultChecked />
            <Switch label="Off" />
          </div>
        </div>
        {/* The top-nav field from 721px; the phone top bar's field (mobile variant) below. flex-none:
            the mobile field flexes along the top bar's row, not down this column. */}
        <SpecRow className="max-md:hidden">
          <Spec label="Search rest">
            <SearchField variant="nav" shortcutHint aria-label="Search (rest)" />
          </Spec>
          <Spec label="Search hover">
            <SearchField variant="nav" wrapperProps={{ "data-force": "hover" } as object} aria-label="Search (hover)" />
          </Spec>
          <Spec label="Search focus (no / hint)">
            <SearchField variant="nav" wrapperProps={{ "data-force": "focus" } as object} defaultValue="falconer" aria-label="Search (focus)" />
          </Spec>
        </SpecRow>
        <div className="flex flex-col gap-4 md:hidden">
          <Spec label="Search rest (phone)" className="w-full">
            <SearchField variant="mobile" wrapperClassName="w-full flex-none" placeholder="Search coaches, programs" aria-label="Search (phone, rest)" />
          </Spec>
          <Spec label="Search focus (phone)" className="w-full">
            <SearchField
              variant="mobile"
              wrapperClassName="w-full flex-none"
              wrapperProps={{ "data-force": "focus" } as object}
              placeholder="Search coaches, programs"
              defaultValue="falconer"
              aria-label="Search (phone, focus)"
            />
          </Spec>
        </div>
        <SpecRow>
          <Spec label="FilterChip off / on / hover">
            <span className="flex flex-wrap gap-2">
              <FilterChip selected={false}>Coordinator</FilterChip>
              <FilterChip selected>Position coach</FilterChip>
              <FilterChip selected={false} data-force="hover">
                Head coach
              </FilterChip>
            </span>
          </Spec>
          <Spec label="Applied filter">
            <AppliedFilterChip label="NWC" removeHref="/dev/components" />
          </Spec>
        </SpecRow>
      </Section>

      <Section id={id("overlays")} title="Menus, popovers, dialogs, toasts, tooltips" note="Level 2 and 3">
        <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Spec label="Menu panel (static)">
            <MenuSurface label="More options">
              <MenuItem icon={Forward}>Share profile</MenuItem>
              <MenuItem icon={Send} className="bg-hover">
                Invite Avery to claim
              </MenuItem>
              <MenuItem icon={Flag} disabled>
                Report an error
              </MenuItem>
              <MenuDivider />
              <MenuItem destructive>Remove from pipeline</MenuItem>
            </MenuSurface>
          </Spec>
          <Spec label="Me menu (the real items, for a sample coach viewer)">
            <MeMenuPreview viewer={viewer} accounts={accounts} />
          </Spec>
          <div className="flex flex-col gap-6">
            <Spec label="Live menu, popover, dialog, toast">
              <span className="flex flex-wrap items-center gap-2">
                <LiveMenu />
                <LivePopover />
                <LiveDialog />
                <LiveToast />
              </span>
            </Spec>
            <Spec label="Tooltip (static; live on the icon buttons above)">
              <span className={TOOLTIP_BUBBLE}>More options</span>
            </Spec>
            <Spec label="Toast (static)" className="w-full">
              <ToastCard message="Saved job removed" actionLabel="Undo" />
            </Spec>
          </div>
        </div>
        <Spec label="Dialog panel (static; a bottom sheet on phone)" className="w-full">
          <div className="w-full rounded-lg bg-overlay p-6 max-md:px-0 max-md:pb-0">
            <DialogPanel
              title="This is a sample listing"
              description="Applications open when Whitworth posts the job here."
              showClose
              footer={
                <>
                  <Button>Cancel</Button>
                  <Button variant="primary">Got it</Button>
                </>
              }
              className="mx-auto"
            />
          </div>
        </Spec>
      </Section>

      <Section id={id("states")} title="Loading, empty and error" note="§8.0 state model">
        <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Spec label="Skeleton blocks" className="w-full">
            <SkeletonRegion className="w-full">
              <div className="flex w-full items-start gap-3">
                <SkeletonAvatar size={40} />
                <SkeletonText className="flex-1" lines={3} />
                <SkeletonTile size={32} />
              </div>
              <Skeleton className="mt-3 h-8 w-full rounded-sm" />
            </SkeletonRegion>
          </Spec>
          <Spec label="Skeleton rows (max 3)" className="w-full">
            <SkeletonRegion className="w-full">
              <SkeletonRows rows={3} avatar={32} />
            </SkeletonRegion>
          </Spec>
          <Spec label="Spinner">
            <span className="flex items-center gap-3 text-fg-2">
              <Spinner /> <span className="text-small">Loading</span>
            </span>
          </Spec>
          <Spec label="Empty state" className="w-full">
            <EmptyState icon={Briefcase} title="No open jobs at Pacific (OR)." description="Set an alert to hear when one is posted." action={<Button>Set a job alert</Button>} spacing="sm" />
          </Spec>
          <Spec label="Error" className="w-full">
            <ErrorState message="Moves didn't load." retryHref="/dev/components" />
          </Spec>
          <Spec label="Disclosure (closed / open)" className="w-full">
            <Disclosure summary="Source">
              <QuoteBlock quote="Falk spent two seasons at Oberlin College as offensive line coach." tone="muted" />
            </Disclosure>
            <Disclosure summary="Source" defaultOpen>
              <QuoteBlock quote="Falk spent two seasons at Oberlin College as offensive line coach." tone="muted" attribution={<SourceLink href="https://goboxers.com" detail="staff bio" />} />
            </Disclosure>
          </Spec>
        </div>
        <SpecRow className="items-center">
          <Spec label="Pagination" className="w-full max-w-md">
            <div className="w-full">
              <Pagination page={2} totalPages={9} prevHref="/dev/components?page=1" nextHref="/dev/components?page=3" />
            </div>
          </Spec>
          <Spec label="Pagination (first page)" className="w-full max-w-md">
            <div className="w-full">
              <Pagination page={1} totalPages={9} prevHref={null} nextHref="/dev/components?page=2" />
            </div>
          </Spec>
          <Spec label="Show more" className="w-full max-w-md">
            <ShowMore href="/dev/components">Show more moves</ShowMore>
          </Spec>
          <Spec label="Divider" className="w-40">
            <Divider className="w-full" />
          </Spec>
        </SpecRow>
      </Section>

      <Section id={id("data")} title="Data display" note="§8.3">
        <Group title="Season strip">
          <SeasonStrip stints={STRIP} />
        </Group>
        <Group title="Season ranges">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Spec label="Ledger (right-aligned; one line on phone)" className="w-full">
              <div className="flex w-full items-start justify-between gap-4 max-md:flex-col max-md:gap-0.5">
                <span className="text-body font-medium">Head Football Coach</span>
                <SeasonRange startYear={2020} endYear={null} isCurrent />
              </div>
            </Spec>
            <Spec label="Multi-stint" className="w-full">
              <div className="flex w-full items-start justify-between gap-4 max-md:flex-col max-md:gap-0.5">
                <span className="text-body font-semibold">Lewis &amp; Clark</span>
                <SeasonRange
                  startYear={null}
                  endYear={null}
                  isCurrent={false}
                  stints={[
                    { startYear: 2003, endYear: 2003, isCurrent: false },
                    { startYear: 2006, endYear: 2009, isCurrent: false },
                  ]}
                />
              </div>
            </Spec>
            <Spec label="Inferred / undated" className="w-full">
              <div className="flex w-full flex-col gap-2">
                <SeasonRange startYear={2021} endYear={2024} isCurrent={false} inferred inferredReason="'from 2021 to 2025' in the MIT bio" variant="inline" />
                <SeasonRange startYear={null} endYear={null} isCurrent variant="inline" />
              </div>
            </Spec>
            <Spec label="Compact (tree rows, rails)">
              <span className="flex gap-4">
                <SeasonRange startYear={2010} endYear={2019} isCurrent={false} variant="compact" />
                <SeasonRange startYear={2020} endYear={null} isCurrent variant="compact" />
                <SeasonRange startYear={2024} endYear={2025} isCurrent={false} variant="compact" inferred />
              </span>
            </Spec>
            <Spec label="Inferred year in text">
              <span className="text-small">
                Played <InferredYear reason="four-year starter, senior season 2000">1997–2000</InferredYear>
              </span>
            </Spec>
          </div>
          <InferredFootnote className="mt-3" />
        </Group>
        <Group title="Stat groups">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <StatGroup
              label="Career stats"
              stats={[
                { value: 25, label: "Seasons coached" },
                { value: 4, label: "Coaching stops" },
                { value: 7, label: "In coaching tree", href: "/feed" },
                { value: 2002, label: "First season", hideOnPhone: true },
              ]}
            />
            <StatGroup
              variant="inline"
              stats={[
                { value: 42, label: "Seasons at Williams" },
                { value: 1985, label: "Joined the staff" },
                { value: 17, label: "Years as a high school head coach" },
              ]}
            />
          </div>
          <p className="mt-2 text-caption text-fg-3">The KPI variant (whole cell is the link, label stays --fg-2) is in the Carousel tracker card above.</p>
        </Group>
        <Group title="People rows">
          <div className="grid gap-6 md:grid-cols-2">
            <ul className="divide-y divide-divider">
              <li className="pb-3">
                <PersonRow
                  name="Avery Falk"
                  href="/feed"
                  tintKey={keys[1]}
                  title="Head Football Coach"
                  org="Pacific (OR)"
                  chips={<UnclaimedChip />}
                  action={<IconButton icon={UserPlus} label="Connect with Avery Falk" variant="secondary" size="sm" />}
                />
              </li>
              <li className="py-3">
                <PersonRow
                  name="Casey Lin"
                  href="/feed"
                  tintKey={keys[2]}
                  size="sm"
                  avatarSize={36}
                  title="Assoc. HC – Defense / DC"
                  org="Brevard"
                  context={<ContextLine icon={Network}>Via Rob Hale · coached Casey at Colorado</ContextLine>}
                  footer={
                    <Button size="sm" icon={Send}>
                      Invite to claim
                    </Button>
                  }
                />
              </li>
              <li className="pt-3">
                <PersonRow name="Robin Hale" unlisted size="sm" avatarSize={32} context={<ContextLine>Named in Avery&apos;s bio · no profile yet</ContextLine>} />
              </li>
            </ul>
            <ul className="divide-y divide-divider">
              <li className="pb-2">
                <PersonRow
                  linkRow
                  name="Dana Ortiz"
                  href="/feed"
                  tintKey={keys[4]}
                  size="sm"
                  avatarSize={32}
                  title="Linebackers Coach · Pacific (OR)"
                  aside={<SeasonRange startYear={2020} endYear={null} isCurrent variant="compact" />}
                  context={<ContextLine>Joined Avery&apos;s staff in 2020</ContextLine>}
                />
              </li>
              <li className="py-2">
                <PersonRow
                  linkRow
                  name="Eli Novak"
                  href="/feed"
                  tintKey={keys[6]}
                  size="sm"
                  avatarSize={32}
                  title="Defensive Coordinator · Linfield"
                  aside={<SeasonRange startYear={2014} endYear={2019} isCurrent={false} variant="compact" />}
                  context={<ContextLine icon={Flag}>Played for Avery 2010–13</ContextLine>}
                />
              </li>
            </ul>
          </div>
        </Group>
        <Group title="Quotes, sources and context">
          <div className="grid gap-6 md:grid-cols-2">
            <QuoteBlock
              size="md"
              quote="In the first season as head coach, the Boxers posted their best Northwest Conference record since 2014."
              attribution={
                <>
                  Quoted from the staff bio · <SourceLink href="https://goboxers.com" />
                </>
              }
            />
            <div className="flex flex-col gap-2">
              <SourceDisclosure evidence="Falk joined the Pacific staff in 2010 as offensive line coach." sourceUrl="https://goboxers.com" sourceDetail="staff bio" />
              <ContextLine icon={GraduationCap}>Portland State alum, like you</ContextLine>
              <ContextLine icon={Info}>Your head coach · hasn&apos;t claimed the profile</ContextLine>
            </div>
          </div>
        </Group>
      </Section>

      <Section id={id("shell")} title="Shell" note="§8.2 · previews render in place">
        <Group title="Top nav items">
          <div className="flex h-[52px] w-fit items-stretch border-b border-border bg-surface">
            <span className={NAV_ITEM}>
              <NavIcon icon={House} />
              <span>Default</span>
            </span>
            <span className={NAV_ITEM} data-force="hover">
              <NavIcon icon={Users} />
              <span>Hover</span>
            </span>
            <span className={NAV_ITEM} aria-current="page">
              <NavIcon icon={Briefcase} />
              <span>Active</span>
            </span>
            <span className={NAV_ITEM}>
              <NavIcon icon={Bell} count={5} />
              <span>Badge</span>
            </span>
            <span className={NAV_ITEM} data-force="focus">
              <NavIcon icon={MessageSquare} />
              <span>Focus</span>
            </span>
          </div>
        </Group>
        <p className="text-caption text-fg-3 md:hidden">The desktop top nav previews need 960px; open this page on a wider screen to see them.</p>
        <Group title="Top nav (desktop)" className="max-md:hidden">
          <div className="overflow-x-auto rounded-md border border-border">
            <TopNav preview viewer={viewer} counts={{ unreadMessages: 2, newNotifications: 5 }} accounts={accounts} />
          </div>
        </Group>
        <Group title="Top nav (signed out)" className="max-md:hidden">
          <div className="overflow-x-auto rounded-md border border-border">
            <TopNav preview viewer={null} counts={{ unreadMessages: 0, newNotifications: 0 }} accounts={accounts} />
          </div>
        </Group>
        <div className="grid items-start gap-6 md:grid-cols-2">
          <Group title="Phone top bar and tab bar">
            <div className="w-full max-w-[390px] overflow-hidden rounded-md border border-border">
              <MobileTopBar preview viewer={viewer} counts={{ unreadMessages: 2, newNotifications: 5 }} accounts={accounts} />
              <div className="h-16 bg-canvas" />
              <BottomTabBar preview viewer={viewer} counts={{ unreadMessages: 2, newNotifications: 5 }} accounts={accounts} />
            </div>
          </Group>
          <Group title="Brand">
            <div className="flex items-center gap-6">
              <BrandMark href="/dev/components" />
              <BrandMark href="/dev/components" variant="mark" />
            </div>
          </Group>
        </div>
        <Group title="Typeahead: results (active row), loading, empty">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <TypeaheadPanel term="fal" results={TYPEAHEAD} options={options} active={0} listId={id("ta1")} />
            <TypeaheadPanel term="fal" results={null} options={[]} active={-1} listId={id("ta2")} />
            <TypeaheadPanel term="zzq" results={{ people: [], programs: [] }} options={typeaheadOptions({ people: [], programs: [] }, "zzq")} active={-1} listId={id("ta3")} />
          </div>
        </Group>
        <Group title="Legal footer">
          <div className="max-w-[304px]">
            <LegalFooter />
          </div>
        </Group>
      </Section>
    </div>
  );
}
