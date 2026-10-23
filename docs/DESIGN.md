# Design system: Coach Network

Read with `docs/PRODUCT_SPEC.md` (what to build) and `docs/ARCHITECTURE.md` (how the code is organized). This file says how everything looks and behaves. If something here disagrees with a proposal in `design/proposals/`, this file wins.

The product name is a placeholder. It lives in one constant, `BRAND.name` in `web/src/lib/brand.ts`, and in the `BRAND` script at the bottom of each reference mockup. Never hard-code it.

**Reference mockups** (source of truth for anything this file leaves open):

| File | What it shows |
| --- | --- |
| `design/reference/profile.html` | Coach profile `/in/ian-falconer` (unclaimed), viewed by the demo coach Justin Leatherman. App shell, right rail, responsive. |
| `design/reference/feed.html` | Home feed `/feed` for Justin Leatherman (Pacific (OR) special teams coordinator). Responsive. |
| `design/reference/*-1440.png`, `*-390.png` | Full-page screenshots at desktop and phone width. |
| `design/reference/*-390-fold.png` | The first phone screen with the fixed tab bar in place (`#fold`). |
| `design/reference/profile-1440-dark.png`, `feed-390-dark.png` | Dark theme (`#dark`). |

Both HTML files are standalone (no build step). Their first `<style>` block is the shared token and component CSS and must stay identical in both; its tokens match §2.4 exactly.

Every person, stint, title, quote and source in the mockups comes from `data/*.json` and the crawled bios. Demo-only values are labeled where they appear: profile-view counts ("demo data"), the Whitworth job ("Sample listing"), follows and saved-job counts, and the "People also viewed" ordering.

---

## 1. Decision record

### 1.1 Base

Three directions were judged by three reviewers on five criteria (clean like LinkedIn, hierarchy, coaching fit, mobile, accessibility; 10 points each).

| Direction | Judge 1 (LinkedIn/Linear) | Judge 2 | Judge 3 | Total |
| --- | --- | --- | --- | --- |
| A, faithful | 36 | 38 | 38 | 112 |
| B, editorial | 39 | 39 | 37 | 115 |
| **C, product** | **40** | **39** | **39** | **118** |

**Base: Direction C.** Its system is kept: warm near-monochrome neutrals, one Iris accent, 1 px borders instead of shadows, a 4 px grid, compact Inter with tabular figures, a right-aligned season ledger, a dot rail for role progression, dashed "time away", sourced evidence, dashed "Sample listing" chips, "Via ..." context lines, network proof on job cards and a shipped dark theme.

### 1.2 Grafts

| From | Idea | Where it lives now |
| --- | --- | --- |
| B | One **season strip** at the top of Experience (one cell per season, labeled by program, three filled levels) replaces C's per-program micro bars | §8.3 SeasonStrip |
| B | **All three tree groups visible** on desktop (Worked under and Worked alongside on the left, Coached under {first name} on the right) | §8.4 Coaching tree card |
| B | **Transactions digest** ("More staff moves") for the long tail of moves | §8.5 TransactionsDigest |
| B | **Move record**: the last two or three stints with a year column, ending on the new role (replaces C's two-cell diff box) | §8.3 MoveRecord |
| B | **Box-score tracker** with a Prom. column | §8.5 CarouselTracker |
| B | **Invite to claim** on unclaimed people in rails | §8.5 PeopleYouMayKnow |
| B | **Breadcrumb** above the profile header | §8.4 Profile |
| B | **AP-style lowercase titles** in feed sentences; non-contiguous ranges written "2003, 2006–2009" | §6 |
| A | **Context strip** at the top of a feed card ("Pacific (OR) · your program") | §8.3 ContextStrip |
| A | **Labeled action bar** (icon over label on phone) | §8.5 ActionBar |
| A | **Viewer's own conference highlighted** in the tracker | §8.5 CarouselTracker |
| A | **Current program** rail card | §8.4 Profile rail |
| A | **Quoted staff-bio line** with a left rule and attribution | §8.3 QuoteBlock |
| A | **Division and conference chips** next to every program name | §8.4 Experience |
| A | **Relationship lines** in the tree ("Played for him 2024–25") and a **per-person Connect** in grouped hires | §8.4, §8.5 |
| New | **Ink count badges** (not Iris), so Iris stays on the one primary action | §8.1 CountBadge |
| New | **About = verbatim source quote** for unclaimed profiles. `ARCHITECTURE.md` forbids generated biography, and C's and B's summaries broke that rule | §8.4 About |

Not adopted: B's serif type, 11 px uppercase kickers, LinkedIn-blue accent and card-less layout; A's composer, Repost/Send actions, pill buttons and cover band.

### 1.3 Every must-fix, resolved

| # | Problem raised | Resolution |
| --- | --- | --- |
| 1 | Phone feed actions were bare icons with no names; 40×32 targets | Action bar always shows text labels; phone cells are icon over a 12 px label, 52 px tall, four fixed slots (§8.5) |
| 2 | Speech bubble meant "Message", paper plane meant "Share" | Congratulate = `handshake`, Comment = `message-circle`, Message = `mail`, Share = `forward` (§7) |
| 3 | Per-program micro bars were illegible (100×6 px, 1.15:1 track) | Removed. One SeasonStrip with filled cells (§8.3) |
| 4 | Single-role groups led with the role, multi-role groups with the program | The program always leads (tile + name + chips). The program header always carries the total range; role rows carry their own range only when a program has two or more roles (§8.4) |
| 5 | Tree labels changed on phone ("Mentors / Peers / Mentees") | One vocabulary everywhere: Worked under · Worked alongside · Coached under {first name}. Phone stacks the groups instead of using a segmented control (§8.4) |
| 6 | Profile "Same tree" rail showed unrelated people, or duplicated the tree card | Built only from second-degree edges through the coach's current staff, excluding anyone already in the tree card; hidden when empty (§8.4) |
| 7 | Tree stat did not equal the sum of the groups (7 vs 8, 12 vs 14) | The stat counts unique people; the card header repeats it ("7 people"); a footnote names whoever appears in two groups (§8.4) |
| 8 | Top nav mixed labeled and icon-only items | Every nav item is icon over label. On tablet, search becomes a labeled "Search" item (§8.2) |
| 9 | Headlines wrapped into a line starting with "/" | Feed sentences use AP lowercase titles with "and" instead of "/", and `text-wrap: balance` (§6) |
| 10 | Action sets varied card to card | Fixed per card type: person items get Congratulate · Comment · Message · Share; program items get Congratulate · Comment · Follow · Share (§8.5) |
| 11 | Box-in-box-in-box borders | At most two border levels. Move record, grouped people and milestone stats sit in the card with dividers only (§5.3) |
| 12 | Tracker footer paired the sample note with "All moves" | A dashed "Sample" chip sits on the Open jobs KPI; the footer holds only "All moves →" (§8.5) |
| 13 | Phone profile put the avatar on its own row | Avatar 56 sits left of the name; actions are one row below (§8.4) |
| 14 | Season strip lost its program labels on phone | Below 721 px the strip becomes one row per program on a shared year axis, each row labeled (§8.3) |
| 15 | Adjacent programs at the same level ran together; "L&C" and "Lewis & Clark" both used | 8 px break at every program change; one label per program, either its short name or its tile initials (§8.3) |
| 16 | Position-coach seasons were outlined and read as missing data | All three levels are filled; an outline is reserved for a gap season (§8.3) |
| 17 | Inferred years (`yearsExplicit=false`) were shown as fact | Dotted underline, a tooltip with the reason, screen-reader "(inferred)" text and a legend, wherever a year appears (§6.2) |
| 18 | Banner promised "every stint links to its sentence" but none did | Every stint has a **Source** disclosure with the verbatim quote and link (§8.3) |
| 19 | Phone range was buried after the note | On phone the range sits on the line right after the title (§8.4) |
| 20 | Division was plain text but the conference was a button-like outlined chip | Both are neutral filled chips (`D-III`, `NWC`), the same in the hero, Experience and rails (§8.1) |
| 21 | No "Unclaimed" marker beside the name | Outline chip next to the name in the header (§8.4) |
| 22 | Feed moves had no source | Every move and digest row ends its meta line with the source domain (§8.5) |
| 23 | Digest had 11 px small caps | Program 13/600, conference chip 12/600, sentence 13/20 (§8.5) |
| 24 | 11 px uppercase kickers | None. All labels are sentence case, 12 px or larger (§4) |
| 25 | Full-page screenshots drew the tab bar mid-page | Capture aid: automated browsers pin the bar to the end of the document (§10) |
| 26 | Strip meaning lived only in tooltips | Strip is `aria-hidden`; the visible key with season counts is its text equivalent; the ledger is the source (§8.3) |
| 27 | Phone job card lost "View job" | Full-width View job (secondary) plus a Save icon button (§8.5) |
| 28 | Source link sat in the action bar with a 16 px target | Moved to the end of the meta line, padded to a 24 px target (§8.5) |
| 29 | Secondary-button border at 1.5:1 | Every control boundary uses `--control` (3.49:1 light, 3.59:1 dark) (§2) |
| 30 | Source links looked like body text | `--link` color, underline and external-link icon (§8.1 Link) |
| 31 | Tree stat had no link affordance | Label in `--link` with a chevron (§8.4) |
| 32 | "2003–2009 · 5 seasons" implied seven straight years | "2003, 2006–2009" over "5 seasons · 2 stints" (§6.1) |
| 33 | Segmented control 31 px tall on phone | 40 px segments with a 44 px hit area. The tree no longer uses one (§8.1) |
| 34 | Dark From/To cells differed by 1.04:1 | The diff box is gone. MoveRecord uses a dot rail, a bold current row and list semantics (§8.3) |
| 35 | Dark focus ring at 3.38:1 | Separate `--focus` token: `#8F9AFF` in dark (7.10:1) (§2) |

Data corrections found while building: the Falconer bio does list his degree ("bachelor's degree in social science from Portland State in 2000"); both proposals said it did not. His playing years are inferred (four-year starter, senior season 2000 → 1997–2000).

---

## 2. Color

### 2.1 Tokens

Neutrals carry a 1–2 % warm tint (hue ≈ 60°). Components use these tokens only, never raw hex values or Tailwind palette colors.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--canvas` | `#F7F7F5` | `#0E0E0D` | Page background |
| `--surface` | `#FFFFFF` | `#161615` | Cards, top nav, tab bar, menus |
| `--surface-2` | `#F9F9F8` | `#1B1B19` | Bands inside a card (source banner), unread rows |
| `--hover` | `#F3F3F1` | `#21211E` | Row and ghost hover, search fill, segmented track, skeleton blocks, disabled fill |
| `--pressed` | `#ECECE9` | `#292926` | Active (pressed) fill |
| `--border` | `#E6E6E3` | `#2A2A27` | Card outlines, nav and tab-bar edges |
| `--divider` | `#EFEFEC` | `#222220` | Lines inside cards |
| `--border-strong` | `#D3D3CF` | `#3A3A36` | Decorative only: role rail, quote rule, `kbd`, strip brackets |
| `--control` | `#8C8983` | `#706F69` | Every control boundary (secondary button, input, checkbox, outline chip, dashed chip), past-role dots |
| `--fg-1` | `#1A1A18` | `#EDEDEA` | Names, titles, body, numbers |
| `--fg-2` | `#5C5B57` | `#A9A8A2` | Secondary lines, meta, inactive nav, icons |
| `--fg-3` | `#6F6E69` | `#8C8B85` | Captions, durations, footnotes, placeholders |
| `--fg-disabled` | `#A3A19B` | `#5F5E59` | Disabled text (exempt from contrast minimums) |
| `--accent` | `#4352D1` | `#4F5DDB` | **Iris.** Primary button fill, checked controls, viewer's row in charts |
| `--accent-hover` | `#3A47B8` | `#4553D2` | Primary hover |
| `--accent-pressed` | `#323E9F` | `#3C49C0` | Primary active |
| `--accent-subtle` | `#EEF0FC` | `#1C1F3A` | Focus halo on inputs, selected typeahead row |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` | Text and icons on Iris |
| `--link` | `#4352D1` | `#8F9AFF` | Links, source links, link-styled stats |
| `--focus` | `#4352D1` | `#8F9AFF` | Focus ring |
| `--danger` | `#B42318` | `#F97066` | Form errors and destructive confirmations only |
| `--danger-subtle` | `#FDECEA` | `#3A1D1B` | Error halo on inputs |
| `--badge-bg` / `--badge-fg` | `#1A1A18` / `#FFFFFF` | `#EDEDEA` / `#161615` | Count badges (ink, never Iris) |
| `--org-bg` / `--org-fg` | `#F0F0EE` / `#45443F` | `#1F1F1D` / `#C9C8C2` | Organization tiles |
| `--lvl-head` | `#1A1A18` | `#EDEDEA` | Season strip: head coach |
| `--lvl-coord` | `#62615C` | `#9C9B95` | Season strip: coordinator |
| `--lvl-pos` | `#AEABA5` | `#55544F` | Season strip: position coach, GA, analyst |
| `--bar` / `--track` | `#5C5B57` / `#EFEFEC` | `#A9A8A2` / `#292926` | Data bars and their tracks |
| `--overlay` | `rgba(14,14,13,.48)` | `rgba(0,0,0,.64)` | Dialog and sheet scrim |

There is no green, red or yellow for status. Status is carried by words, icons and position. Iris appears only on: the one primary button, links, focus rings, checked form controls and the viewer's own row in a chart.

### 2.2 Contrast (WCAG 2.1, computed)

| Pair | Light | Dark | Requirement |
| --- | --- | --- | --- |
| `fg-1` on `surface` / `canvas` | 17.43 / 16.25 | 15.44 / 16.47 | 4.5 |
| `fg-2` on `surface` / `canvas` / `surface-2` / `hover` | 6.80 / 6.34 / 6.45 / 6.12 | 7.60 / 8.10 / 7.24 / 6.77 | 4.5 |
| `fg-3` on `surface` / `canvas` / `surface-2` / `hover` | 5.11 / 4.76 / 4.85 / 4.60 | 5.30 / 5.65 / 5.05 / 4.72 | 4.5 |
| `link` on `surface` / `canvas` / `surface-2` | 6.24 / 5.82 / 5.92 | 7.10 / 7.57 / 6.76 | 4.5 |
| `on-accent` on `accent` / `accent-hover` / `accent-pressed` | 6.24 / 7.57 / 9.03 | 5.36 / 6.14 / 7.23 | 4.5 |
| `badge-fg` on `badge-bg` | 17.43 | 15.44 | 4.5 |
| `org-fg` on `org-bg` | 8.55 | 9.85 | 4.5 |
| `danger` on `surface` | 6.57 | 6.50 | 4.5 |
| `control` on `surface` / `canvas` / `hover` (UI boundary) | 3.49 / 3.25 / 3.14 | 3.59 / 3.83 / 3.20 | 3.0 |
| `focus` on `surface` / `canvas` | 6.24 / 5.82 | 7.10 / 7.57 | 3.0 |
| Strip steps: `lvl-pos`/surface · `lvl-coord`/`lvl-pos` · `lvl-head`/`lvl-coord` | 2.29 · 2.71 · 2.81 | 2.39 · 2.72 · 2.38 | supplementary graphic, `aria-hidden`; its key carries the numbers |

### 2.3 People tints

Initials sit on one of six soft tints. Pick by FNV-1a (32-bit) over the person's slug, `mod 6`, so a person keeps the same color everywhere. Tints are identity, never meaning. (Replace `hueFor()` in `lib/format.ts` with `tintFor(slug): 1..6`.)

| | Light bg / fg | Contrast | Dark bg / fg | Contrast |
| --- | --- | --- | --- | --- |
| `c1` Slate | `#E5E9F0` / `#3B4A63` | 7.35 | `#222833` / `#AFC0DA` | 8.01 |
| `c2` Sage | `#E3EDE6` / `#2F5A3F` | 6.60 | `#1D2A22` / `#A3CCAF` | 8.40 |
| `c3` Sand | `#F1EADF` / `#6A4C1F` | 6.59 | `#2E2719` / `#DDC59A` | 8.82 |
| `c4` Clay | `#F3E5E3` / `#7A3A33` | 6.90 | `#33201E` / `#E3AFA7` | 8.02 |
| `c5` Plum | `#EDE6F0` / `#5A3D6B` | 7.42 | `#2B2131` / `#CDB3DC` | 8.12 |
| `c6` Teal | `#DFEDEE` / `#1F5A5F` | 6.51 | `#172A2C` / `#9ACED2` | 8.64 |

### 2.4 Paste-ready tokens (`web/src/app/globals.css`, Tailwind v4)

Theme rule: tokens follow the OS (`prefers-color-scheme`); `data-theme="light"` or `"dark"` on `<html>` forces one. Components never use `dark:` variants; the tokens switch on their own.

```css
@import "tailwindcss";

/* ---------- 1. Runtime tokens ---------- */
:root {
  --canvas: #F7F7F5; --surface: #FFFFFF; --surface-2: #F9F9F8; --hover: #F3F3F1; --pressed: #ECECE9;
  --border: #E6E6E3; --divider: #EFEFEC; --border-strong: #D3D3CF; --control: #8C8983;
  --fg-1: #1A1A18; --fg-2: #5C5B57; --fg-3: #6F6E69; --fg-disabled: #A3A19B;
  --accent: #4352D1; --accent-hover: #3A47B8; --accent-pressed: #323E9F; --accent-subtle: #EEF0FC; --on-accent: #FFFFFF;
  --link: #4352D1; --focus: #4352D1; --danger: #B42318; --danger-subtle: #FDECEA;
  --badge-bg: #1A1A18; --badge-fg: #FFFFFF; --org-bg: #F0F0EE; --org-fg: #45443F;
  --lvl-head: #1A1A18; --lvl-coord: #62615C; --lvl-pos: #AEABA5; --bar: #5C5B57; --track: #EFEFEC;
  --av1-bg: #E5E9F0; --av1-fg: #3B4A63; --av2-bg: #E3EDE6; --av2-fg: #2F5A3F; --av3-bg: #F1EADF; --av3-fg: #6A4C1F;
  --av4-bg: #F3E5E3; --av4-fg: #7A3A33; --av5-bg: #EDE6F0; --av5-fg: #5A3D6B; --av6-bg: #DFEDEE; --av6-fg: #1F5A5F;
  --overlay: rgba(14, 14, 13, .48);
  --elev-pop: 0 0 0 1px rgba(26, 26, 24, .06), 0 8px 24px -6px rgba(26, 26, 24, .16);
  --elev-btn: 0 1px 1px rgba(26, 26, 24, .04);
  /* Shell sizes */
  --nav-h: 52px; --mtop-h: 48px; --tabbar-h: 56px;
  --page-max: 1200px; --rail-left: 232px; --rail-feed: 304px; --rail-profile: 320px; --rail-tablet: 280px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --canvas: #0E0E0D; --surface: #161615; --surface-2: #1B1B19; --hover: #21211E; --pressed: #292926;
    --border: #2A2A27; --divider: #222220; --border-strong: #3A3A36; --control: #706F69;
    --fg-1: #EDEDEA; --fg-2: #A9A8A2; --fg-3: #8C8B85; --fg-disabled: #5F5E59;
    --accent: #4F5DDB; --accent-hover: #4553D2; --accent-pressed: #3C49C0; --accent-subtle: #1C1F3A; --on-accent: #FFFFFF;
    --link: #8F9AFF; --focus: #8F9AFF; --danger: #F97066; --danger-subtle: #3A1D1B;
    --badge-bg: #EDEDEA; --badge-fg: #161615; --org-bg: #1F1F1D; --org-fg: #C9C8C2;
    --lvl-head: #EDEDEA; --lvl-coord: #9C9B95; --lvl-pos: #55544F; --bar: #A9A8A2; --track: #292926;
    --av1-bg: #222833; --av1-fg: #AFC0DA; --av2-bg: #1D2A22; --av2-fg: #A3CCAF; --av3-bg: #2E2719; --av3-fg: #DDC59A;
    --av4-bg: #33201E; --av4-fg: #E3AFA7; --av5-bg: #2B2131; --av5-fg: #CDB3DC; --av6-bg: #172A2C; --av6-fg: #9ACED2;
    --overlay: rgba(0, 0, 0, .64);
    --elev-pop: 0 0 0 1px rgba(255, 255, 255, .06), 0 8px 24px -6px rgba(0, 0, 0, .6);
    --elev-btn: none;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  /* identical to the block above; keep the two in sync */
  --canvas: #0E0E0D; --surface: #161615; --surface-2: #1B1B19; --hover: #21211E; --pressed: #292926;
  --border: #2A2A27; --divider: #222220; --border-strong: #3A3A36; --control: #706F69;
  --fg-1: #EDEDEA; --fg-2: #A9A8A2; --fg-3: #8C8B85; --fg-disabled: #5F5E59;
  --accent: #4F5DDB; --accent-hover: #4553D2; --accent-pressed: #3C49C0; --accent-subtle: #1C1F3A; --on-accent: #FFFFFF;
  --link: #8F9AFF; --focus: #8F9AFF; --danger: #F97066; --danger-subtle: #3A1D1B;
  --badge-bg: #EDEDEA; --badge-fg: #161615; --org-bg: #1F1F1D; --org-fg: #C9C8C2;
  --lvl-head: #EDEDEA; --lvl-coord: #9C9B95; --lvl-pos: #55544F; --bar: #A9A8A2; --track: #292926;
  --av1-bg: #222833; --av1-fg: #AFC0DA; --av2-bg: #1D2A22; --av2-fg: #A3CCAF; --av3-bg: #2E2719; --av3-fg: #DDC59A;
  --av4-bg: #33201E; --av4-fg: #E3AFA7; --av5-bg: #2B2131; --av5-fg: #CDB3DC; --av6-bg: #172A2C; --av6-fg: #9ACED2;
  --overlay: rgba(0, 0, 0, .64);
  --elev-pop: 0 0 0 1px rgba(255, 255, 255, .06), 0 8px 24px -6px rgba(0, 0, 0, .6);
  --elev-btn: none;
  color-scheme: dark;
}

/* ---------- 2. Static scales ---------- */
@theme {
  --color-*: initial;            /* drop Tailwind's palette: only the tokens below exist */
  --breakpoint-*: initial;
  --breakpoint-md: 45.0625rem;   /* 721px  tablet */
  --breakpoint-lg: 67.5625rem;   /* 1081px desktop */
  --breakpoint-xl: 80rem;        /* 1280px wide desktop */
  --spacing: 0.25rem;            /* 4px grid: p-1=4, p-2=8, p-3=12, p-4=16, p-5=20, p-6=24, p-8=32 ... */

  --text-hero: 2.25rem;      --text-hero--line-height: 2.75rem;    --text-hero--letter-spacing: -0.025em;  --text-hero--font-weight: 600;
  --text-hero-sm: 1.75rem;   --text-hero-sm--line-height: 2.25rem; --text-hero-sm--letter-spacing: -0.02em; --text-hero-sm--font-weight: 600;
  --text-display: 1.5rem;    --text-display--line-height: 2rem;    --text-display--letter-spacing: -0.02em; --text-display--font-weight: 600;
  --text-display-sm: 1.25rem; --text-display-sm--line-height: 1.75rem; --text-display-sm--letter-spacing: -0.02em; --text-display-sm--font-weight: 600;
  --text-stat: 1.25rem;      --text-stat--line-height: 1.75rem;    --text-stat--letter-spacing: -0.015em;  --text-stat--font-weight: 600;
  --text-stat-sm: 1.125rem;  --text-stat-sm--line-height: 1.5rem;  --text-stat-sm--letter-spacing: -0.01em; --text-stat-sm--font-weight: 600;
  --text-title: 1rem;        --text-title--line-height: 1.5rem;    --text-title--letter-spacing: -0.01em;  --text-title--font-weight: 600;
  --text-subtitle: 0.9375rem; --text-subtitle--line-height: 1.375rem; --text-subtitle--letter-spacing: -0.01em;
  --text-body: 0.875rem;     --text-body--line-height: 1.25rem;
  --text-prose: 0.875rem;    --text-prose--line-height: 1.375rem;
  --text-small: 0.8125rem;   --text-small--line-height: 1.125rem;
  --text-caption: 0.75rem;   --text-caption--line-height: 1rem;

  --radius-xs: 4px;   /* chips, kbd, tooltips */
  --radius-sm: 6px;   /* buttons, inputs, segmented, 32px org tiles */
  --radius-md: 8px;   /* cards, menus, 40px org tiles */
  --radius-lg: 12px;  /* dialogs, sheets, 56px org tiles */

  --container-page: 75rem;     /* 1200px incl. 24px gutters -> 1152 content */
  --container-main: 50.5rem;   /* 808px profile main column max */
  --container-prose: 42.5rem;  /* ~68ch */
  --container-dialog: 30rem;   /* 480px */
}

/* ---------- 3. Runtime-resolved theme values ---------- */
@theme inline {
  --font-sans: var(--font-inter), "Inter", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --color-canvas: var(--canvas); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-hover: var(--hover); --color-pressed: var(--pressed);
  --color-border: var(--border); --color-divider: var(--divider); --color-border-strong: var(--border-strong); --color-control: var(--control);
  --color-fg-1: var(--fg-1); --color-fg-2: var(--fg-2); --color-fg-3: var(--fg-3); --color-fg-disabled: var(--fg-disabled);
  --color-accent: var(--accent); --color-accent-hover: var(--accent-hover); --color-accent-pressed: var(--accent-pressed);
  --color-accent-subtle: var(--accent-subtle); --color-on-accent: var(--on-accent);
  --color-link: var(--link); --color-focus: var(--focus); --color-danger: var(--danger); --color-danger-subtle: var(--danger-subtle);
  --color-badge-bg: var(--badge-bg); --color-badge-fg: var(--badge-fg); --color-org-bg: var(--org-bg); --color-org-fg: var(--org-fg);
  --color-lvl-head: var(--lvl-head); --color-lvl-coord: var(--lvl-coord); --color-lvl-pos: var(--lvl-pos);
  --color-bar: var(--bar); --color-track: var(--track); --color-overlay: var(--overlay);
  --color-av1-bg: var(--av1-bg); --color-av1-fg: var(--av1-fg); --color-av2-bg: var(--av2-bg); --color-av2-fg: var(--av2-fg);
  --color-av3-bg: var(--av3-bg); --color-av3-fg: var(--av3-fg); --color-av4-bg: var(--av4-bg); --color-av4-fg: var(--av4-fg);
  --color-av5-bg: var(--av5-bg); --color-av5-fg: var(--av5-fg); --color-av6-bg: var(--av6-bg); --color-av6-fg: var(--av6-fg);
  --color-transparent: transparent; --color-current: currentColor;
  --shadow-pop: var(--elev-pop);
  --shadow-btn: var(--elev-btn);
}

/* ---------- 4. Base ---------- */
@layer base {
  html { -webkit-text-size-adjust: 100%; }
  body {
    background: var(--canvas); color: var(--fg-1); font-family: var(--font-sans);
    font-size: 0.875rem; line-height: 1.25rem; font-optical-sizing: auto; font-feature-settings: "cv11";
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  }
  p, li, h1, h2, h3, h4 { text-wrap: pretty; }
  :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
}
```

Load Inter with `next/font/google` (`Inter({ subsets: ["latin"], variable: "--font-inter", axes: ["opsz"] })`) and put the variable class on `<html>`. Utility names: `bg-surface`, `text-fg-2`, `border-divider`, `text-caption`, `rounded-md`, `shadow-pop`, `max-w-page`, `md:` (tablet and up), `lg:` (desktop). Mobile-first: unprefixed classes are the phone layout.

---

## 3. Principles

1. **Ledger, not timeline.** Careers are measured in seasons. Ranges sit in a right-aligned tabular column so a career reads top to bottom like a statement.
2. **One accent, one job.** Iris marks the single primary action in a view, links, focus and checked controls. Everything else is ink on paper.
3. **Borders over shadows, two levels at most.** Canvas, then a bordered card. Shadows only on things that float.
4. **Show the receipt.** Unclaimed data says so and links to its source. Inferred years are marked. Sample data looks provisional. We never write biography about real people.
5. **Warm through people.** Initials on soft tints, first names in labels ("Coached under Ian"), and a reason on every suggestion ("Via Rob Hutchins · coached him at Colorado").
6. **Same words, same numbers, every width.** A label or count never changes between desktop and phone.

---

## 4. Typography

**Family:** Inter (variable, optical size 14–32, weights 400–700). `cv11` on everywhere (single-storey a). `font-variant-numeric: tabular-nums` (`tabular-nums` utility) on every number that can sit in a column: seasons, ranges, counts, KPIs.

| Token / utility | Size / line | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `text-hero` (phone `text-hero-sm`) | 36/44 (28/36) | 600 | −0.025em | Landing h1 only |
| `text-display` (phone `text-display-sm`) | 24/32 (20/28) | 600 | −0.02em | Profile name, program name, job title on detail |
| `text-stat` (phone `text-stat-sm`) | 20/28 (18/24) | 600 | −0.015em | Header stats, tracker KPIs, milestone stats |
| `text-title` | 16/24 | 600 | −0.01em | Card titles ("Experience") |
| `text-subtitle` | 15/22 | 400–600 | −0.01em | Profile headline, job title in lists, mini-profile name |
| `text-body` | 14/20 | 400 | 0 | Default text, feed sentences, names (600), role titles (500) |
| `text-prose` | 14/22 | 400 | 0 | Quotes and paragraphs, max width 68ch |
| `text-small` | 13/18 (ranges 13/20) | 400–600 | 0 | Meta lines, buttons, ranges, tree names, digest |
| `text-caption` | 12/16 | 400–600 | 0 | Durations, context lines, chips, footnotes, nav and tab labels |

Rules: nothing smaller than 12 px (initials inside avatars and tiles smaller than 32 px are exempt; they are `aria-hidden`). Sentence case everywhere: no all-caps, no letter-spaced kickers, no italics (quotes use a left rule). `text-wrap: pretty` on paragraphs and `balance` on feed headlines. Names 600, role titles 500, body 400.

---

## 5. Spacing, radii, borders, elevation, motion

### 5.1 Spacing (4 px grid)

Scale: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64` (`1 2 3 4 5 6 8 10 12 16` in Tailwind units).

- Card padding: `20px 24px` for main-column cards on desktop; `16px` for rail cards, feed items and every phone card.
- Gap between cards: 12 desktop, 8 phone. Column gutters: 24.
- Lists: rows separated by a 1 px `--divider` with 10–12 px above and below. Never stack padding and margin.
- **52 px text line:** inside a card, text that follows a 40 px avatar or tile starts at 52 px (40 + 12). Feed bodies, role rows and person rows share it. On phone the feed body goes full width (0 offset).

### 5.2 Radii

`4` chips, `kbd`, tooltips · `6` buttons, inputs, segmented control, 32 px tiles · `8` cards, menus, 40 px tiles · `12` dialogs, sheets, 56 px tiles · `50%` avatars only. **People are circles; organizations are rounded squares.** Phone cards are full-bleed: radius 0, no side borders.

### 5.3 Borders and elevation

| Level | Treatment | Use |
| --- | --- | --- |
| 0 | `--canvas` | Page |
| 1 | `--surface` + 1 px `--border`, radius 8 | Cards, top nav, tab bar |
| 1-band | `--surface-2` + 1 px `--divider` top, full card width | Source banner, unread rows |
| 2 | `--surface` + `shadow-pop` | Menus, typeahead, toasts, tooltips (no border) |
| 3 | `--surface` + `shadow-pop` over `--overlay` | Dialogs, sheets |

**Two border levels at most.** Inside a card, separate with `--divider` lines or a `--surface-2` band. A bordered box inside a bordered card is a bug. Secondary buttons get `shadow-btn` in light mode only.

### 5.4 Z-index

`nav/tabbar 30 · sticky rails 10 · dropdown/typeahead 40 · dialog/sheet 50 · toast 60 · tooltip 70`.

### 5.5 Motion

120 ms `ease` on color, background and border. Disclosure chevrons rotate 90° in 120 ms. Menus and toasts fade in with a 4 px rise over 140 ms. Nothing else moves: no shimmer, parallax or celebration effects. All of it is off under `prefers-reduced-motion`.

---

## 6. Content and formatting rules

All formatting goes through `web/src/lib/format.ts`. Add these functions there; do not format inline.

### 6.1 Season ranges

| Case | `seasonRange()` output (range / count) |
| --- | --- |
| Single season | `2003` / `1 season` |
| Closed | `2010–2019` / `10 seasons` |
| Current | `2010–Present` / `17 seasons` (count through `CURRENT_SEASON`) |
| Start unknown | `Years not in source` / `4 seasons` if the count is stated, else no count |
| Non-contiguous at one program | `2003, 2006–2009` / `5 seasons · 2 stints` (new: `seasonRangeMulti(stints)`) |
| Compact (tree rows, rails and the MoveRecord year column only) | `2010–19`, `2020–` (new: `seasonRangeCompact()`); the full range and count go in `aria-label` |

Always an en dash (U+2013), never a hyphen. Always `tabular-nums`. Always `white-space: nowrap`. A range or count is never truncated: truncate the title next to it.

### 6.2 Inferred years

A year from a tenure with `yearsExplicit = false` renders as `<span class="inf" title="Inferred: ...reason...">2020</span><span class="sr-only"> (inferred)</span>`: dotted 1.5 px underline in `--fg-3`, 3 px offset, `cursor: help`. The `title` gives the reason in plain words, quoting the source phrase where possible ("Inferred from 'two years' between the 2003 and 2006 Lewis & Clark stints"). Tooltips don't exist on touch, so every page that shows an inferred year also explains the mark once in visible text: on a profile, the Experience legend ("2004 Year inferred from the bio, not stated in it"); in the feed and in lists, a 12 px footnote in the first card that shows one ("Dotted years are inferred from his bio, not stated in it."). This applies to the profile ledger, playing career, tree rows and feed move records.

### 6.3 Titles and sentences

- **Standalone title** (profile role rows, headers, lists): as published, Title Case ("Head Football Coach").
- **Long titles in compact rows** (over 40 characters): `titleShort()` abbreviates Assistant → Asst., Associate → Assoc., Head Coach → HC (only after Assoc./Asst.), Offensive Coordinator → OC, Defensive Coordinator → DC, Special Teams Coordinator → ST Coord., Quarterbacks → QB, Linebackers → LB, Defensive Backs → DBs, Strength & Conditioning → S&C. Slashes are allowed here.
- **Feed sentences**: AP style. Lowercase titles, joined with "and" and commas, never "/" ("joined MIT as offensive coordinator and quarterbacks coach"). Templates: `{Person} joined {Org} as {title}` · `{Person} was promoted to {title} at {Org}` · `{Org} named {n} new {group}` · `{Person} is in his/her {ordinal} season on the {Org} staff`. Pronouns come only from the source; if none, use the name again.
- **Dates:** we have seasons, not announcement dates. Show "2026 season", never "2h ago". Use `timeAgo()` only for user-generated events with real timestamps (messages, notifications from claimed users).
- **Conferences and divisions**: chips with the abbreviation (`NWC`, `D-III`, `D-I FCS`, `High school`) and the full name in `title`. Prose may spell them out.
- **Possessives with first names** in labels: "Coached under Ian", "Joined Ian's staff in 2020".

### 6.4 Sources and demo data

- Unclaimed profiles: source banner in the header card, "Unclaimed" chip next to the name, a Source disclosure on every stint, About as a verbatim quote (or empty state). **Never generate prose about a real person.**
- Feed: every move ends its meta line with the source domain (`mitathletics.com` + external icon).
- Anything with `isDemo` or `source === "sample"`: a dashed chip on the record itself, "Sample listing" for jobs and "Demo" elsewhere. Aggregate demo numbers get a footnote ("Past 7 days · demo data").

---

## 7. Iconography

**Lucide** (ISC), outline only, `lucide-react` in the app. Sizes 12 / 14 / 16 / 20 / 22 px with stroke 2 / 1.9 / 1.75 / 1.75 / 1.6. Icons inherit `currentColor` and are `aria-hidden`; the control carries the name.

| Concept | Icon | Concept | Icon |
| --- | --- | --- | --- |
| Home | `house` | Congratulate | `handshake` |
| Network | `users` | Comment | `message-circle` |
| Jobs | `briefcase` | Message (DM) | `mail` |
| Messaging (nav) | `message-square` | Share | `forward` |
| Notifications | `bell` | Follow | `plus` |
| Search | `search` | Connect | `user-plus` |
| For employers | `layout-grid` | Invite to claim | `send` |
| Coaching tree, tree context | `network` | Claim | `shield-check` |
| Alma mater | `graduation-cap` | Source link | `external-link` |
| New hire / Promotion / Milestone | `log-in` / `chevrons-up` / `flag` | Program context | `building-2` |
| Info (banner) | `info` | Private setting | `lock` |
| Save job | `bookmark` | More | `ellipsis` |

Never use a football, whistle, trophy, helmet, stadium or clipboard. The brand mark is a three-node tree (one node above two) on a 24 px ink square, radius 6.

---

## 8. Components

### 8.0 State model (applies to every component)

| State | Rule |
| --- | --- |
| Hover | Background steps one level (`transparent → --hover`, `--surface → --hover`, Iris → `--accent-hover`); text may step `--fg-2 → --fg-1`. Links underline (2 px offset). 120 ms. |
| Focus-visible | 2 px solid `--focus` outline at 2 px offset, radius follows the control. Inputs use the Iris border plus a 3 px `--accent-subtle` halo instead. Never remove focus without a replacement. |
| Active (pressed) | `--pressed` fill (Iris: `--accent-pressed`). Selected tabs use the 2 px ink underline; selected segments use `--surface` plus a 1 px `--border` ring. |
| Disabled | `--hover` fill, `--fg-disabled` text, no border, no shadow, `cursor: not-allowed`, no hover change. Use `aria-disabled="true"` with a tooltip when the user needs to know why. |
| Loading | Buttons keep their width; a 14 px spinner (1.5 px ring, 700 ms linear spin; a static ring under reduced motion) replaces the leading icon; `aria-busy="true"`. Content loads as a **skeleton** that matches the final layout. |
| Skeleton | Static `--hover` blocks (no shimmer): text lines 10 px tall at the text's line-height rhythm, radius 4; circles for avatars, rounded squares for tiles. Card chrome (border, title) renders for real. Max 3 rows per list. `aria-busy` on the region and a visually hidden "Loading". |
| Empty | Inside the card that would hold the content, never a blank page. 20 px icon in `--fg-3`, one 14/500 sentence stating the fact, one 13 `--fg-2` line on what happens next, at most one secondary button. No illustrations. |
| Error | Inline in the region: `--danger` icon + one sentence + "Try again" ghost button. Form fields: `--danger` border, `--danger-subtle` halo on focus, 12 px message below with an icon, `aria-invalid` and `aria-describedby`. |

### 8.1 Primitives (`web/src/components/ui/*`)

**Button**

| Variant | Visual | Use |
| --- | --- | --- |
| `primary` | Iris fill, `--on-accent` 13/500 | One per view: Connect, Apply, Publish, Post job, Send |
| `secondary` | `--surface`, 1 px `--control` border, `--fg-1`, `shadow-btn` | Message, View job, Claim profile, View staff, Show more |
| `ghost` | Transparent, `--fg-2` | Feed actions, toolbar scope, menu triggers |
| `danger` | `--danger` fill, white | Destructive confirmation inside a dialog only |
| `icon` | Square secondary or ghost | More, Save, Connect in rows, Close |

Sizes: `sm` 28 px (padding 10), `md` 32 px (padding 12, default on desktop), phone 40 px visual with a 44 px hit area (`::before` inset −2 px), header and job-card actions 44 px on phone. Radius 6, gap 6 between icon and label, icon 16 (14 in `sm`). Label 13/500, no wrap. States per §8.0. Toggle buttons (Connect → "Pending", Follow → "Following") switch to secondary with a check icon and `aria-pressed="true"`.

**Link** · `--link`, 500. Underline on hover. Links inside prose and every **SourceLink** are always underlined (1 px, offset 2) and end with a 12 px `external-link` icon when they leave the site. Visited = same color. Name and title links outside sentences (people rows, breadcrumb, job titles) get a 24 px tall target with `padding-block: 3px; margin-block: -3px`.

**Card** · `--surface`, 1 px `--border`, radius 8. Header row: title (`text-title`) left; right side holds at most one link ("Explore tree →") and one meta (`text-small --fg-3`, e.g. "7 people"), baseline-aligned. Skeleton: real chrome plus 3 line blocks. Empty: EmptyState inside.

**Avatar** · Sizes 24 / 28 / 32 / 36 / 40 / 48 / 56 / 64 / 80. Circle, tint from `tintFor(slug)`, two initials (`initials()`), weight 600, font size ≈ 0.34 × size. `aria-hidden` when the name is adjacent, else `role="img"` + `aria-label`. A claimed photo uses `object-fit: cover`. **Unlisted person** (named in a source, no profile): `--surface` fill, `--fg-3` initials, 1 px dashed `--control` ring, name not linked, context line "Named in {first}'s bio · no profile yet".

**OrgMark** · Rounded square 24 (r5, 9 px text) / 32 (r6, 11 px) / 40 (r8, 13 px) / 56 (r12, 18 px). `--org-bg` fill, `--org-fg` initials (2–3 letters from `shortName`), inset 1 px `--border`. These initials are also the program's short label in the season strip.

**Chip** · 20 px tall, radius 4, 12/500, 6 px side padding, never interactive.

| Kind | Look | Examples |
| --- | --- | --- |
| Neutral | `--hover` fill, `--fg-2` | `D-III`, `High school`, `Position coach`, season `2026` |
| Abbreviation | Neutral, 600, +0.02em, full name in `title` | `NWC`, `NEWMAC` |
| Outline | Transparent, inset 1 px `--control` | `Unclaimed` |
| Sample | Transparent, 1 px **dashed** `--control` | `Sample listing`, `Demo`, `Sample` |

**FilterChip** (search facets, job filters) · 32 px desktop / 40 px phone, radius 6, secondary look; selected = `--fg-1` fill with `--surface` text plus a check icon, `aria-pressed`. A removable applied filter has an × with its own `aria-label`.

**CountBadge** · 18 px pill, min-width 18, padding 0 5, `--badge-bg` / `--badge-fg`, 12/600 tabular, 2 px `--surface` ring, at the icon's top-right. The count goes in the parent's `aria-label` ("Notifications, 5 new"). Over 99 shows "99+".

**Tabs** (page tabs: program Staff · Alumni coaches · Jobs; search People · Programs) · 44 px tall, 13/500 `--fg-2`, 16 px padding; active `--fg-1` with a 2 px ink underline flush with the divider below. `role="tablist"`, arrow-key roving focus. A tab may show a count in `--fg-3`. Tabs that are URLs (`?tab=`) are links styled as tabs.

**SegmentedControl** (in-card filters, feed filter) · Track `--hover` with 2 px padding, radius 6; segments 28 px desktop, 40 px phone (44 px hit area), 13/500 `--fg-2`; selected `--surface` + 1 px `--border` ring + `--fg-1`. Full width with equal segments on phone. Use for 2–4 short options only. Never hide primary content behind it (the coaching tree does not use it).

**Input / Textarea / Select** · Height 36 desktop / 44 phone, radius 6, `--surface` fill, 1 px `--control` border, 13 px text (16 px on phone to avoid zoom), placeholder `--fg-3`. Hover: border `--fg-3`. Focus: border `--accent` + 3 px `--accent-subtle` halo. Invalid: border `--danger`, message below. Disabled: `--hover` fill, `--fg-disabled`. Label 13/500 above (always visible, no placeholder-as-label), help text 12 `--fg-3` below. Textarea min 3 rows, resizes vertically.

**Checkbox / Radio / Switch** · Box 16 px, radius 4 (radio circle), 1.5 px `--control` border; checked = Iris fill with a white check or dot. Switch 32×20, off = `--control` track outline with a `--fg-3` knob, on = Iris track with a white knob. Hit area is the whole label row (≥ 44 px on phone). Group label 13/600.

**SearchField + Typeahead** · Field 32 px desktop (280 px wide, 256 at 1081–1279), 40 px phone (flex, 44 px hit area); `--hover` fill, no border at rest, 1 px `--border` on hover, Iris border + halo on focus; 16 px search icon; placeholder "Search coaches and programs"; `/` `kbd` hint on desktop. Typeahead panel: level 2, radius 8, 4 px padding, min width = field width, max 480. Groups **People** (avatar 24, name, current title · program) and **Programs** (tile 24, name, division · conference), 44 px rows, active row `--accent-subtle`, ↵ hint on the active row, "See all results for '{q}'" as the last row. Keyboard: ↑ ↓ Enter Esc; `role="combobox"` / `listbox`. Loading: 3 skeleton rows. Empty: "No coaches or programs match '{q}'." + "Try a last name, a school or a conference abbreviation."

**Menu** · Level 2 panel, radius 8, 4 px padding, min width 200. Items 32 px desktop / 44 px phone, 13 px, icon 16 `--fg-2`, hover `--hover`, destructive items `--danger` text. Dividers `--divider`. `role="menu"`, arrow keys, Esc returns focus to the trigger.

**Dialog / Sheet** · Dialog: max width 480, radius 12, padding 24, title `text-title`, footer actions right-aligned (secondary then primary). Phone: bottom sheet, radius 12 12 0 0, a drag handle (32×4 `--border-strong`), safe-area padding. Scrim `--overlay`. Focus trap, Esc and scrim close (unless destructive), focus returns to the trigger.

**Toast** · Level 2, radius 8, 13 px, max width 400; bottom-left 24 px on desktop, above the tab bar on phone. One line plus an optional "Undo" link. Auto-dismiss after 5 s (paused on hover/focus); `role="status"`.

**Tooltip** · `--fg-1` fill, `--surface` text 12/16, radius 4, padding 4 8, 400 ms delay, on hover and focus. Never the only way to get information on touch.

**Disclosure** · `<details>`: summary 12 px `--fg-3` with a 12 px chevron that rotates 90° when open, 24 px target. Used for **Source** on stints.

**ShowMore / Pagination** · Lists that start truncated end with a full-width secondary "Show more {noun}" (44 px on phone). Search uses Previous / Next secondary buttons plus "Page 2 of 9" (13 `--fg-2`); no numbered page strip.

### 8.2 Shell (`web/src/components/shell/*`)

**AppShell grid**

| Breakpoint | Feed | Profile, program, job detail | Search |
| --- | --- | --- | --- |
| `lg` ≥ 1081 | `232 · 1fr (≈568) · 304`, gutters 24 | `1fr (max 808) · 320` | `232 · 1fr` |
| `md` 721–1080 | `1fr · 280` (left rail moves into the Me menu) | 961–1080: `1fr · 280`; 721–960: one column, rail cards below in a 2-up grid | `1fr`, facets in a sheet |
| phone ≤ 720 | One column, full-bleed cards | One column; rail content below main; "People also viewed" dropped | One column, facets in a sheet |

Container: max 1200 px with 24 px side padding (1152 content), centered; page padding top 16–20, bottom 48. Rails are `position: sticky` 16–20 px below the nav.

**TopNav** (`md` and up) · 52 px, `--surface`, 1 px bottom `--border`, sticky. Left: brand (mark + wordmark 15/650; wordmark visually hidden at 721–900). Then the SearchField (`lg`) or a "Search" nav item (`md`, opens a full-width search overlay). Right, every item an icon (20 px) over a 12/500 label, min width 64 (56 at `md`): **Home, Network, Jobs, Messaging, Notifications, Me ▾**, a 32 px vertical divider, **For employers**. Inactive `--fg-2`, hover `--fg-1`, active `--fg-1` plus a 2 px ink bar flush with the bottom border (`aria-current="page"`). Count badges per CountBadge.

**MobileTopBar** (≤ 720) · 48 px, sticky. Me avatar (32 in a 44 hit area) · SearchField (flex, 40 px visual, 44 px hit area, 16 px input text, placeholder "Search coaches, programs") · Messaging icon button 44 with badge (`aria-label="Messaging, 2 unread"`).

**BottomTabBar** (≤ 720) · `position: fixed`, 56 px + `env(safe-area-inset-bottom)`, `--surface`, 1 px top border. Five equal cells: **Home · Network · Jobs · Notifications · Me** (avatar 24), icon 22 over a 12/500 label, 3 px gap. Inactive `--fg-2`, active `--fg-1` + 600 + 2.1 stroke (no pill). `body` gets matching `padding-bottom`. Capture aid in §10.

**Me menu + DemoSwitcher** · Menu panel: header row (avatar 40, name, "View profile" link), divider, **Demo account** radio group: "Coach (claimed): Justin Leatherman", "Athletic director: Pacific (OR)", "Signed out", each with a one-line description in 12 `--fg-3`, then Settings, Open to opportunities, Theme (System / Light / Dark radios), divider, "Sign out". Switching sets the cookie, closes the menu and shows a toast ("Now viewing as ...").

**RightRail** · Stack of rail cards (16 px padding) with 12 px gaps, then the LegalFooter: 12 px `--fg-3`, 24 px line height, links About · Data sources · Accessibility · Privacy · Terms, then "{BRAND} © 2026".

### 8.3 Data-display components

**SeasonRange** · Two lines right-aligned in a 128 px column: range 13/500 tabular over count 12 `--fg-3`. Phone: one line under the title, range 600 then "· N seasons". Formats in §6.1.

**InferredYear** · §6.2.

**SourceBanner** (unclaimed profiles) · Full-width band at the bottom of the header card: `--surface-2`, 1 px `--divider` top, padding 12 24 (12 16 phone), 13/20 `--fg-2`. Info icon 16, then "Built from public sources: [goboxers.com staff bio ↗] and the [Pacific staff directory ↗]. Each role below links to the sentence it came from." Right: "Is this you?" + **Claim profile** (secondary `sm`, `shield-check`). Phone: the claim row wraps under the text, button 44 px. `role="note"`. It is neutral on purpose: unclaimed is normal, not an error. Claimed profiles show no banner.

**Source disclosure** · On every stint: Disclosure "Source"; open shows a QuoteBlock with the verbatim evidence and the SourceLink ("goboxers.com · Ian Falconer bio ↗"). Closed by default.

**QuoteBlock** · 2 px `--border-strong` left rule, 12–14 px left padding, quote in curly quotes 13/20 (14/22 in About) `--fg-1`, then a 12 px `--fg-3` attribution ("From his MIT staff bio", or a SourceLink). Max 68ch. Quotes are verbatim, typos included.

**ContextLine** · 12/16 `--fg-3`, optional 12 px icon in `--fg-2` naming the reason type (`network` tree, `graduation-cap` school, `flag` player relationship, `info` status). Patterns: "Via {person} · {how}", "{School} alum, like you", "Played for him 2024–25", "Joined Ian's staff in 2020". Every suggestion of a person carries one.

**ContextStrip** (feed) · Band at the top of a feed card: padding 8 16, 12/16 `--fg-2`, 12 px icon, the subject in 600 `--fg-1`, then "·" and the reason ("Pacific (OR) · your program", "NEWMAC · a conference you follow", "Portland State · alum, like you", "Ian Falconer · your head coach"). 1 px `--divider` below. Only for personal reasons; items without one have no strip.

**StatBand** · A row of equal columns split by 1 px `--divider`, top divider; each: value `text-stat` tabular over a 12 px `--fg-2` label. A linked stat (tree count) has its label in `--link` 500 with a 12 px chevron, underline on hover. Profile: 4 columns desktop (Seasons coached · Coaching stops · In coaching tree · First season), 3 on phone (drop First season).

**SeasonStrip** · One figure at the top of Experience showing every season from the first to `CURRENT_SEASON`.

- Grid: one `1fr` column per season with a 2 px column gap, plus a 4 px spacer track at each program change (an 8 px break in total). Build `grid-template-columns` in the component.
- Cells 16 px tall (10 on phone), radius 3 (2 on phone), filled by the level of that season's main role: `--lvl-head` head coach, `--lvl-coord` coordinator (including associate/assistant head coach with coordinator duties), `--lvl-pos` position coach, GA, analyst. A season with no coaching stint is an empty cell with a 1 px dashed `--border-strong` outline. Player seasons are not shown.
- Labels (desktop, `md` and up): one row above, each spanning its segment, 12/500 `--fg-2`, with a 1 px `--border-strong` bracket underneath. One label per program: its `shortName` if it fits every one of its segments, otherwise its OrgMark initials (the same letters as the tile in the ledger below).
- Phone (≤ 720): one row per program, in order of first season, on the same year axis, so the career reads as a staircase. Each program's label sits above its first cell and may run right over empty columns; a program with several stints keeps them in one row.
- Axis: 12 px `--fg-3` tabular years at the first season, each decade start and the current season.
- Key (the text equivalent, always visible): swatch + "Head coach · **7** seasons", "Coordinator · **4** seasons", "Position coach · **14** seasons" (13 `--fg-2`, numbers 600 `--fg-1`). Omit levels with zero seasons.
- The grid is `aria-hidden="true"`; the key and the ledger carry the meaning. Hidden when the coach has fewer than 2 dated seasons.

**MoveRecord** (feed) · `<ol>` of the last 2–3 stints, oldest first, ending on the new role. Row: year column 56 px (12/500 tabular `--fg-3`, compact ranges), a 7 px dot on a 1 px `--border-strong` rail, then "{title, AP lowercase} · {org}" 13/20 `--fg-2`. The new role: `--fg-1`, year 600, title 600, filled ink dot. Same-org promotions drop the org from every row. No border or fill around it.

**KPIStrip** · StatBand variant bled to the card edges (negative margins), three columns; each KPI is a link to its filtered list. A sample-based KPI carries a dashed "Sample" chip next to its label.

**BoxScoreTable** · Real `<table>` with a visually hidden caption. Header 12/500 `--fg-3`, right-aligned numbers, bottom divider. Rows 13/18, 5 px vertical padding, label left (no wrap), optional bar column (`aria-hidden`, 6 px `--bar` on `--track`, scaled to the max), numeric columns 40 px, tabular, 500. The viewer's row: separated by a divider, 600 weight, "· yours" in `--fg-3`, Iris bar.

### 8.4 Coach profile `/in/[slug]` (reference: `profile.html`)

Order: Breadcrumb · Header card · About · Experience · Playing career · Coaching tree · Education. Rail: Current program · Same tree · People also viewed.

**Breadcrumb** (`md` and up) · "{Program short name} › Staff › {Name}", 13 `--fg-2`, chevrons 14 `--fg-3`, current page `--fg-1` with `aria-current="page"`. Spans both columns above the grid, so the rail top aligns with the header card. Hidden on phone.

**Header card** · Padding 24 24 0. Grid `avatar 80 · identity · actions`.
- Identity: name `text-display` (h1) + `Unclaimed` outline chip (with a `title` explaining it); headline 15/22 "{Title} at [{Program}]" (program 500, linked); meta row 13 `--fg-2`: pin + "City, ST", division chip, conference chip.
- Actions: **Connect** (primary, `user-plus`), **Message** (secondary, `mail`), **More** (icon, menu: Share profile, Invite {first} to claim, Report an error). On an unclaimed profile, Connect and Message open an "Invite {first} to claim" sheet, since nobody can receive them yet.
- StatBand, then SourceBanner (unclaimed only).
- `md` (721–1080): actions move under the identity block, left-aligned.
- Phone: avatar 56 inline left of the name (`display-sm`), headline 14/20, actions one full-width row (44 px: Connect and Message flex, More 44×44), StatBand with 3 columns.
- Skeleton: avatar circle, two text lines, three stat blocks. Claimed profiles: no banner and no chip; Message works directly.

**About** · Claimed: the coach's own text (`text-prose`, max 68ch, "Show more" after 5 lines). Unclaimed: a QuoteBlock with one or two verbatim sentences from the source bio + "Quoted from his staff bio · [domain ↗]", then the footnote "{First} can replace this with his own About after claiming the profile." No bio sentence worth quoting → empty state: "No About yet." / "{First} can add one after claiming the profile."

**Experience card** · Header "Experience" + meta "4 programs · 25 seasons". SeasonStrip. Then an ordered list of program groups, newest first, separated by dividers:
- **Group header** (always program first): OrgMark 40 · name 14/600 (linked if the program has a page) + division and conference chips inline · city line 13 `--fg-2` · SeasonRange on the right with the program total.
- **Role rows** (newest first): 40 px rail column with an 8 px dot (ink = current, hollow `--control` ring = past) joined by a 1 px `--border-strong` line; title 14/500; level line 13 `--fg-2` ("Head coach", "Coordinator", "Position coach", plus a short structured note such as "original staff when the program restarted"); Source disclosure; SeasonRange on the right **only when the program has two or more roles**.
- **Time away**: between two stints at one program, a 12 px `--fg-3` row "Away 2004–2005 · Oberlin College" on a dashed `--control` rail segment.
- **Legend** footer (only the marks that appear): Current role · Past role · Time away · Year inferred.
- Phone: the range moves under the title (600 range · count); the group header stacks (name and chips, city, range).
- Empty: "No coaching history in the source." / "{First} can add his career after claiming the profile." Skeleton: 2 groups, each with a tile and 3 lines.

**Playing career** · Same group-header layout: tile, school + level chip, "Position · honor" line, SeasonRange (dotted if inferred). Stints with `asPlayer` only. Hidden when empty.

**Coaching tree card** (`id="tree"`) · Header "Coaching tree" + meta "{n} people" + "Explore tree →".
- `lg`: two columns split by a divider. Left (1fr): **Worked under** then **Worked alongside**. Right (2fr): **Coached under {first name}** in a 2-column grid. Group heads 13/600 with the count in `--fg-3`.
- Row: the whole row is one link to the profile (at least 44 px tall): avatar 32 · name 13/600 with the compact range right-aligned on the same line (12/500 tabular) · current title 12 `--fg-2` (truncate) · optional ContextLine ("Played for him 2024–25", "Joined Ian's staff in 2020"). Hover underlines the name.
- `md` and phone: groups stack in one column; "Coached under" shows 3 rows + "Show all {n}" (44 px link). Labels are identical at every width.
- **Counts reconcile**: the header stat and card meta count unique people. When someone appears in two groups, both rows stay, and the footnote says so: "7 people. Jim Craft and Kit Taura are listed twice because they worked alongside Ian before joining his staff. Derived from overlapping seasons on the same staff."
- Mentors without a profile use the Unlisted avatar.
- Empty group: "No one yet." in 13 `--fg-3` under the group head. Whole tree empty: "No coaching tree yet." / "It fills in as coaches who worked with {first} are added." + secondary "Invite a colleague".

**Education** · Tile, school, degree line ("Bachelor's degree, social science"), year on the right with "Graduated". Hidden when empty.

**Rail: Current program** · Rail card: title + "View program →"; tile 40, program name 13/600, "{Nickname} · City, ST", chips; key-value rows with dividers (Staff on {BRAND} · Program restarted / founded · Open jobs); two `sm` secondary buttons (View staff · athletics site ↗).

**Rail: Same tree** · Subtitle "Two steps from {first}, through his current staff". Rows: avatar 36, name, title · program, ContextLine "Via {staff member} · {how}", Connect icon button (`sm`, `aria-label="Connect with {name}"`). Source: tree edges and shared stints of the coach's current staff at other organizations, excluding anyone in the tree card, up to 3. **Hidden when empty.**

**Rail: People also viewed** · Passive list (avatar 32, name, "Title · Program · Conf"), whole row is the link, up to 4. Dropped on phone.

### 8.5 Home feed `/feed` (reference: `feed.html`)

**MiniProfile** (left rail, `lg`) · Avatar 48, name 15/600, title 13 `--fg-2`, program row (tile 24 + name 12); divider; key-values "Profile viewers 38", "Search appearances 112" (links), footnote "Past 7 days" (+ "· demo data" in demo); divider; **Open to opportunities** row: label 13/500 + "Off · only you see this" / "On · visible to search firms" with `lock` icon, chevron, links to settings. It never shows on the public profile.

**Shortcuts** · Card with 8 px padding; 36 px rows: icon 16, label 13 `--fg-2`, count 12 `--fg-3` tabular (My coaching tree, Programs I follow, Saved jobs).

**FeedToolbar** · SegmentedControl All · Moves · Jobs · Milestones, plus a ghost "Showing **Division III** ▾" scope menu on the right (`lg`). Phone: segments full width, scope moves into the filter sheet.

**PhoneTrackerSummary** (≤ 720, first in the feed) · Card link, min 64 px: "Carousel tracker · 2026" (14/600) over "**20** hires · **8** promotions · **3** sample jobs", chevron. Opens the tracker page.

**FeedItem** (card, `overflow: hidden`) · Optional ContextStrip; body padding 16 16 0; header grid `40 · 1fr · auto`:
- avatar 40 (person) or OrgMark 40 (program);
- **headline** `<h2>` 14/20 with names and programs 600 and linked, `text-wrap: balance`, AP style (§6.3);
- **meta** 12/16 `--fg-3`: kind label (`--fg-2` 500 with a 12 px icon: New hire `log-in`, Promotion `chevrons-up`, Milestone `flag`, Job `briefcase`, "2 new hires") · conference abbreviation · "2026 season" · **source domain** (`--link` 500, external icon, 24 px target), separated by "·";
- More (ghost icon, 32; 44 on phone): Save, Copy link, Hide moves like this, Report an error.

Body (indented 52 px on desktop, full width on phone), by kind:

| Kind | Body | Action set |
| --- | --- | --- |
| Hire with a prior career | MoveRecord (2–3 rows); optional QuoteBlock from the new staff bio | Person |
| Hire with no prior stint | One facts line 13 `--fg-2` ("Linebacker at Pacific (OR), 2024–2025") | Person |
| Promotion | MoveRecord, same org dropped from rows; optional facts line ("NFL quarterback 2013–2017") | Person |
| Grouped hires (one program, 2+ people) | People rows separated by dividers: avatar 32, name 13/600, `titleShort` title 12 `--fg-1`, ContextLine "Previously ...", Connect icon button each | Program |
| Milestone | StatBand of 2–3 facts (no box), then one facts line | Person |
| Job | JobCard (below) | none |

**ActionBar** · Four equal slots under a 1 px divider, padding 4 8. Desktop: ghost buttons 40 px, icon 16 + 13/500 label. Phone: 52 px cells, icon over a 12 px label. **Person set:** Congratulate · Comment · Message · Share. **Program set:** Congratulate · Comment · Follow · Share. Slots never collapse or reorder. Pressed Congratulate toggles to "Congratulated" with a filled icon (`aria-pressed`).

**JobCard** · Same frame. Meta first ("Job · Matches your position group"), title 15/600 (linked), "Program · City, ST · Conf · Full-time" 13 `--fg-2`, chips (`Sample listing` dashed first when demo, then role group and division), network proof: up to three 24 px avatars spaced 4 px apart (never overlapping) + one sentence ("Your colleagues John Bates and Nic Brockhoff played here"). Actions top-right: Save (icon, `aria-pressed` when saved) + **View job** (secondary). Phone: actions become a bottom row, View job full width (44 px) + Save 44×44. Apply is primary on the job detail page only.

**TransactionsDigest** · Card "More staff moves" + meta "2026 season · Division III". Rows split by dividers: program 13/600 (linked) + conference chip; one AP sentence 13/20 ("Named **Adrian Saterstad** offensive line coach; he was assistant defensive line coach at Michigan Tech in 2025."); meta 12 `--fg-3` "New hire · [source ↗]". Footer: full-width secondary "Show more moves". Moves without a personal reason go here after the first 6 full items; never more than one digest per 20 items.

**CarouselTracker** (right rail) · Title + `2026` chip; sub "Division III · 14 programs with staff data"; KPIStrip (Hires · Promotions · Open jobs with a "Sample" chip); BoxScoreTable "Conference · bar · Hires · Prom." with the top 5 by hires (ties by promotions) **plus the viewer's conference** as a separate last row when it is not in the top 5; footer with only "All moves →". All numbers computed from tenures with `startYear = CURRENT_SEASON` (hire = new org, promotion = new role at the same org). Skeleton: 3 KPI blocks + 5 rows. Empty: "No moves recorded for 2026 yet."

**PeopleYouMayKnow** · Subtitle "Through your staff and schools". Up to 3 rows: avatar 36, name, title · program, ContextLine with the reason, Connect icon button. An unclaimed coach the viewer knows shows "{relation} · hasn't claimed his profile" and a labeled `sm` secondary **Invite to claim** (`send`) under the text instead of Connect.

Feed states: skeleton = 3 item cards (avatar, 2 lines, 3 record lines, action bar outline). Empty (filter): inside a card, "No {filter} in Division III for 2026 yet." / "New {filter} show up here first." + secondary "Clear filter". End of feed: "You're up to date" footnote centered.

### 8.6 Program page `/programs/[slug]`

- **Header card**: OrgMark 56, name `text-display` (h1), "{Nickname} · City, ST" 15 `--fg-2`, chips (division, conference), athletics SourceLink. Actions: **Follow** (primary) + More. StatBand: Staff listed · Alumni coaches · Open jobs · Program founded or restarted. Phone: tile 48 inline.
- **Tabs** Staff · Alumni coaches · Jobs (URL `?tab=`), counts in `--fg-3`.
- **Staff tab**: one card per unit in order **Head coach · Offense · Defense · Special teams · Support**. Rows: avatar 40, name 14/600, title 13 `--fg-2`, "Since 2020" SeasonRange right (or "Start year not in source" 12 `--fg-3`), `Unclaimed` chip when relevant. Unit with no staff: hidden. Whole tab empty: "No staff listed for {Program}." / "We couldn't read this program's staff page yet." + "Report a staff page".
- **Alumni coaches tab**: rows: person, "{role here} · {range}" and "Now {title} at {program}" ContextLine. Sorted by most recent.
- **Jobs tab**: JobCard rows; empty: "No open jobs at {Program}." + secondary "Set a job alert".
- Rail: Conference peers (programs, tile 32) and "Coaches from here" (people).

### 8.7 Search `/search`

- Layout `lg`: facets 232 (no card, sticky) + results. `md`/phone: a "Filters (n)" secondary button opens a sheet; applied filters show as removable FilterChips in a horizontally scrollable row (fade mask on the right edge).
- Query header: "{n} results for '{q}'" `text-title`; Tabs People · Programs.
- **Facet group**: title 13/600, checkbox list (13 px, count 12 `--fg-3` right), "Show more" after 6. Facets: Division, Conference, State, Role group (Head coach, Coordinator, Position coach, GA / analyst, Support), Worked at (program combobox), Worked under (coach combobox). "Clear all" link at the top when any is applied.
- **Person result**: card row, avatar 48, name 15/600 + `Unclaimed` chip, "{Title} at {Program}" 13 `--fg-2`, chips (division, conference), one ContextLine of tree context ("Worked under Ian Falconer at Pacific, 2023–"), Connect icon button right. 16 px padding, rows separated by dividers inside one card.
- **Program result**: OrgMark 48, name 15/600, "{Nickname} · City, ST", chips, "12 staff · 3 alumni coaches" 12 `--fg-3`, Follow icon button.
- Pagination per §8.1. Loading: 5 skeleton rows. Empty: "No coaches or programs match '{q}'." / "Try a last name, a school or a conference abbreviation." + "Clear filters" if any are applied.

### 8.8 Coaching tree explorer `/in/[slug]/tree`

- Page header: back link "‹ {Name}", h1 "{Name}'s coaching tree" (`text-display`), meta "{n} people · derived from overlapping seasons", a SegmentedControl **Diagram · List** (List is the default on phone and the accessible equivalent).
- **Diagram** (inline SVG, in a card): the coach in the middle (avatar 64 + name 14/600), **Worked under** row above, **Coached under {first}** rows below (wrap at 6 per row), **Worked alongside** to the left and right. Nodes: avatar 40 + name 12/600 + compact range 12 `--fg-3`, a 44×44 minimum target, focusable `<a>` links to the profile. Edges: 1.5 px `--border-strong` curves; the hovered or focused node's edges become `--fg-2` and the rest fade to 40 %. Unlisted people use the dashed avatar and are not links.
- Keyboard: Tab enters the diagram at the center node; arrow keys move up / down / left / right between rows; Enter opens; Esc returns to the page. Touch: tap selects a node and shows a bottom sheet with the person row and "Open profile"; pinch and drag pan and zoom (buttons + − and "Reset" for non-gesture users).
- **List**: the three groups exactly as the profile tree card, without truncation.
- Empty: "No coaching tree yet." + "Invite a colleague". Loading: center node + 6 skeleton nodes.

### 8.9 Jobs `/jobs` and `/jobs/[id]`

- **List**: h1 "Jobs", FilterChips (Role group ▾, Division ▾, State ▾) opening menus with checkboxes; results as JobCards in one card with dividers; Save per row. Count line "{n} open jobs · {k} sample listings". Empty: "No jobs match these filters." + "Clear filters".
- **Detail**: main card: OrgMark 56, title `text-display` (h1), "Program · City, ST · Full-time", chips (Sample listing, role group, division), actions **Apply** (primary) + Save (secondary). Sections (cards): About the role, Responsibilities, Qualifications, "Your network here" (avatars + sentence). Sample listings keep the dashed chip in the header and Apply opens a dialog: "This is a sample listing. Applications open when {Program} posts on {BRAND}." Rail: Program card (as Current program) and Similar jobs.

### 8.10 Signed-out landing `/`

- Top bar: brand, "Sign in" (ghost) and "For employers" (ghost); no tab bar.
- Hero (centered, max 640): h1 `text-hero` one-line value prop, sub 15/22 `--fg-2`, a 48 px search field (radius 8, 1 px `--control`, primary "Search" button inside on the right). Phone `text-hero-sm`, field 48, button below full width.
- **Proof points**: three StatBand columns with real numbers read from `data/stats.json` at build (e.g. "244 Division III programs", "151 coaches with sourced careers", "426 coaching-tree connections"), labels 13 `--fg-2`, a footnote "Counts update as staff pages are added."
- **Sample profiles**: three compact profile cards (avatar 48, name, title at program, chips, "25 seasons · 7 in tree", `Unclaimed` chip where true), each linking to the profile.
- Footer: LegalFooter centered.

### 8.11 Claim flow `/claim/[slug]` (P1)

- Single centered column, max 640. Stepper: three steps **Confirm identity · Review your career · Publish**, 13/500, current step `--fg-1` with an ink number disc, done steps a check, upcoming `--fg-3`; `aria-current="step"`.
- Step 1: "Use your school email" Input + primary "Send code"; then a 6-digit code Input (`inputmode="numeric"`, `autocomplete="one-time-code"`), "Resend code" link after 30 s. Stub label "Demo: any code works" as a Demo chip.
- Step 2: each stint as a row (tile 32, title, program, SeasonRange, Source disclosure) with a SegmentedControl **Correct · Edit · Remove**; Edit expands an inline form (title, program combobox, start and end season selects, "Current role" checkbox). Add-a-stint secondary button at the end. Inferred years are flagged with the dotted underline and the hint "Confirm these years".
- Step 3: preview of the header card as it will appear (no banner), primary **Publish profile**, secondary Back. Success toast + redirect to the profile.

### 8.12 Open to opportunities `/settings/availability` (P1)

- Card "Open to opportunities" with a Switch (label row 44 px) and the line "Never shown on your public profile" (`lock` icon, 12 `--fg-3`).
- "Who can see it": radio group **Search firms** · **Specific programs** (reveals a program multi-select combobox) · **All employers except my current program** (default).
- "Roles you'd consider": FilterChips for role groups. "Regions": FilterChips by state or region. Footer: primary **Save**, secondary Cancel; disabled until something changes.

### 8.13 Post a job `/employers/jobs/new` (P1)

- `lg`: form (1fr) + sticky preview (360) side by side; phone: form, then a "Preview" disclosure.
- Form card sections: Role (title, role group select, unit select), Program (prefilled from the AD's program, read-only chip), Location and type (city, state, full-time / part-time / GA radios), Pay (min and max, optional; shows `salaryRange()`), Description (textarea), Application (URL or email).
- Preview: the JobCard exactly as the feed will show it, plus the detail header.
- Checkout stub: a summary card (listing, 30 days, price shown as a Demo chip) and primary **Publish listing**; success toast and redirect to the pipeline.

### 8.14 Hiring pipeline `/employers/pipeline` (P1)

- Header: h1 "Hiring pipeline", job switcher (select), primary "Add candidate".
- `lg`: four columns **Sourced · Contacted · Interview · Offer** (each min 240, header 13/600 + count, `--hover` column background, radius 8, 8 px padding, 8 px gap between cards). Phone: Tabs for the four stages, one column.
- **Candidate card** (surface, 1 px border, radius 8, 12 px padding): avatar 32, name 13/600, title at program 12 `--fg-2`, ContextLine for tree context, footer "2 notes" 12 `--fg-3` + More menu ("Move to ▸", Remove). Drag and drop between columns, with a keyboard alternative via "Move to". While dragging: `shadow-pop` and a dashed `--control` drop slot.
- Notes: a sheet with a textarea and the note history (author, date, text).
- Empty column: "No candidates here yet." 13 `--fg-3` inside the column.

### 8.15 Messaging `/messaging` (P2)

- `lg`: list 320 + thread in one card split by a divider. Phone: list, then thread on its own page with a back button.
- List row 64 px: avatar 40, name 13/600, one-line snippet 12 `--fg-2`, time 12 `--fg-3`; unread = 600 snippet + an 8 px ink dot; selected = `--hover`.
- Thread: header (avatar, name, title at program, More); messages flat, not bubbles (avatar 32, name 13/600, time 12 `--fg-3`, text 14/20), grouped by sender within 5 minutes; date dividers. Composer: textarea (auto-grow to 6 lines) + primary **Send** (disabled when empty). Demo conversations carry a Demo chip in the header.
- Empty: "No messages yet." / "Messages from coaches and employers show up here."

### 8.16 Notifications `/notifications` (P2)

- One card; SegmentedControl All · Moves · Jobs · Mentions at the top.
- Rows 16 px padding, dividers: avatar 40 or tile 40, one sentence 13/20 (names 600), time or "2026 season" 12 `--fg-3`, More menu. Unread: `--surface-2` row + an 8 px ink dot on the left edge. Clicking marks read.
- "Mark all as read" ghost button in the header. Empty: "You're all caught up."

---

## 9. Accessibility

- Landmarks: `header`, `nav` (labeled "Primary"), `main`, `aside` (labeled), `footer`. One `h1` per page (the feed has a visually hidden "Home feed" h1; feed items use `h2`).
- Every icon-only control has `aria-label` and a tooltip. Counts live in the control's name ("Notifications, 5 new").
- Focus is always visible (`--focus`, ≥ 3:1 in both themes). Tab order follows visual order; rails come after main on phone.
- Color is never the only signal: current role = filled dot + "Current role" legend; viewer's conference = bold + "· yours" + Iris bar; inferred = dotted underline + "(inferred)" text; sample = dashed chip + the words.
- Charts and strips are `aria-hidden` with a visible text equivalent; tables use `<th scope>` and a caption.
- Touch targets per Quality bar rule 7. Inputs use 16 px text on phone.
- `prefers-reduced-motion` disables all transitions and animation.

---

## 10. Verification and capture

Screenshot every route at 1440 and 390:

```
node tools/screenshot.mjs <url-or-file> <out.png> 1440 900 1
node tools/screenshot.mjs <url-or-file> <out.png> 390 844 1
```

**Capture aid.** Chromium full-page screenshots draw `position: fixed` elements at the first-viewport position, which puts the tab bar mid-page. `BottomTabBar` therefore checks `navigator.webdriver` (true under Playwright) and, unless the URL hash contains `fold`, sets `class="capture-full"` on `<html>`, which switches the bar to `position: absolute` at the end of the document. Real users are unaffected. To see the real first screen: `node tools/screenshot.mjs "<url>#fold" out.png 390 844 0`. In the mockups `#dark` / `#light` force a theme.

Check at 721, 900 and 1081 as well: no horizontal scroll at any width.

---

## 11. UI quality bar

Auditors check every screen against these 12 rules. A screen ships when all 12 pass at 1440 and 390, in light and dark.

1. **Type floor.** No text renders below 12 px, and no label is all-caps or letter-spaced; everything is sentence case. Only initials inside avatars and tiles smaller than 32 px are exempt.
2. **One primary.** At most one Iris-filled button is visible per view (a dialog or sheet is its own view). Iris appears nowhere else except links, focus rings, checked controls and the viewer's row in a chart. Count badges are ink.
3. **Season ranges.** Every range comes from `seasonRange()`, `seasonRangeMulti()` or `seasonRangeCompact()`: tabular numerals, an en dash (U+2013, never a hyphen), a count written "N season(s)", gaps written "2003, 2006–2009 · 5 seasons · 2 stints". No range or count is ever truncated or wrapped.
4. **Inferred is visible.** Every year from a tenure with `yearsExplicit = false` has the dotted underline, a tooltip giving the reason and screen-reader "(inferred)" text. Every page that shows one explains the mark once in visible text (the Experience legend on profiles; a footnote in the first feed or list card that shows one).
5. **Every fact has a receipt.** Unclaimed profiles show the source banner and an "Unclaimed" chip by the name. Every stint has a Source disclosure with the verbatim quote. Every feed move and digest row shows its source domain. No prose about a real person is generated.
6. **Demo honesty.** Every `isDemo` or sample record shows a dashed "Sample listing" or "Demo" chip on the record itself. No relative timestamps ("2h ago") appear without a real timestamp behind them; seasons read "2026 season".
7. **Touch targets.** At ≤ 720 px every button, tab, segment, toggle and form control has a hit area of at least 44×44 px (the visual can be 40 with an expanded hit area), and every list row that is itself a link is at least 44 px tall. Every other link has a target at least 24 px tall, except links inside running sentences. Desktop controls are at least 32 px tall.
8. **Labels.** The top nav, the bottom tab bar and every feed action bar show visible text labels. Icon-only controls are limited to More, Save, Close, Connect in list rows and the phone Messaging button, and each has an `aria-label` and a tooltip.
9. **Contrast from tokens only.** Components use only the token pairs in §2.2: text ≥ 4.5:1, control boundaries and focus rings ≥ 3:1, in both themes. `grep -rE "#[0-9a-fA-F]{3,8}\b|rgb\(" web/src/components` finds nothing, and no Tailwind palette color class is used.
10. **Two border levels.** Canvas, then a bordered card, and nothing deeper. Inside a card, content is separated by dividers or a `--surface-2` band, never by another bordered box.
11. **Same words, same numbers.** Labels are identical at every breakpoint (tree groups are always "Worked under / Worked alongside / Coached under {first name}"). Any number shown in two places matches, and a deduplicated count says so in a footnote.
12. **Phone layout.** At 390 px there is no horizontal scroll; side gutters are 16 px; fixed bars never cover content; the first screen of a profile shows the name, headline, actions and stats. No headline line starts with punctuation: AP lowercase titles, no "/" in sentences, `text-wrap: balance`.

---

## 12. Do and don't

| Do | Don't |
| --- | --- |
| Right-align ranges in a tabular column | Put dates in prose where a ledger fits |
| One primary button per view | Make Connect, Claim and Apply all primary on one screen |
| Separate with hairlines and canvas | Shadow a card, nest a bordered box, or use gradients |
| Initials on a soft tint; people circles, programs squares | Use photos you don't have rights to, logos, or emoji |
| Quote the source verbatim and link it | Paraphrase or summarize a real person's bio |
| Mark inferred years and sample data | Present derived or demo data as confirmed |
| "2026 season" when the date is unknown | Invent "2d ago" |
| Explain every suggestion with a ContextLine | Show "People you may know" without a reason |
| Keep status in words, icons and position | Introduce green, red or yellow for status |
| Abbreviate conferences in chips with the full name in `title` | Spell out conferences where space is tight |
| Truncate titles with an ellipsis, never years | Let a range or season count be cut off |
| Sentence case, 600 for names, 500 for roles | ALL-CAPS kickers, italics for emphasis |
