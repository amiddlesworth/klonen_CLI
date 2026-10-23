# Direction C: Modern product

The product name is a placeholder. It lives in one constant: `BRAND.name` in the `<script>` at the bottom of each mockup, and `web/src/lib/brand.ts` in the app. Every visible instance (wordmark, footer, `<title>`) reads from it.

**The idea.** Build it like the best current SaaS tools (Linear, Stripe, Vercel) and point that craft at people instead of tickets. The palette is near-monochrome warm neutrals with one Iris accent. The rules are a 4 px grid and 1 px borders in place of shadows. Type is compact Inter with tabular figures, so season ranges line up like a ledger. Warmth comes from the people: soft tinted initials, plain-language context lines ("Via Rob Hutchins · Colorado") and honest sourcing. Decoration adds none of it.

| File | What it is |
| --- | --- |
| `profile.html` | Coach profile `/in/ian-falconer` (unclaimed), app shell, right rail. Responsive. |
| `feed.html` | Signed-in home feed (demo account: Justin Leatherman, Pacific). Responsive. |
| `profile-1440.png`, `feed-1440.png` | Desktop, 1440 px viewport, full page. |
| `profile-390.png`, `feed-390.png` | Phone, 390 px, full page (shot with `#fullpage`, see Motion & capture). |
| `profile-390-fold.png`, `feed-390-fold.png` | Phone, first 844 px screen as a user sees it, fixed tab bar in place. |
| `profile-1440-dark.png`, `feed-390-dark.png` | Dark theme (`#dark` in the URL forces it; otherwise it follows the OS). |

**Content.** All coaches, stints, titles and sources come from the pilot extraction (`pacific_or.json`, `mit.json`, `norwich.json`, `brevard.json`, `buena_vista.json`, `williams.json`, `wilkes.json`) and the derived `data/tree_edges.json`. Moves are phrased from real 2026 stints: "joined" for a new program and "promoted" for a new role at the same one. Inferred years are marked as inferred. The About text is a summary of the public bio, and the page labels it that way. Demo-only values are the profile-view counts, the follow and saved-job counts, the "people also viewed" ordering and the Whitworth job, which is labeled *Sample listing*. The demo user's "Open to opportunities" is shown **Off**, because we will not put a job-search signal in a real person's mouth.

---

## 1. Principles

1. **Ledger, not timeline.** Coaching careers are measured in seasons. Every range sits in a right-aligned tabular column (`2010–2019 / 10 seasons`) so a career scans top to bottom like a statement. Numbers are the hero, never ornaments.
2. **One accent, one job.** Iris marks the single primary action per view, links, focus and unread counts. Everything else is ink on paper. If a screen shows more than about four Iris elements, remove some.
3. **Borders over shadows.** Surfaces are separated by 1 px hairlines and a slightly darker canvas. Shadows are reserved for things that float: menus, typeahead, toasts.
4. **Show the receipt.** Unclaimed data says so, links to its source and marks inferred years with a dotted underline. Sample data looks visibly provisional (dashed chip). Trust is the product.
5. **Warm through people.** Initials on soft tints, first names in labels ("Coached under Ian"), and context lines that explain *why* someone is shown. Never warm through gradients, illustrations or sports imagery.

---

## 2. Color

### 2.1 Tokens

Neutrals carry a 1–2 % warm tint (hue ≈ 60°), which keeps the grays from reading clinical next to the people tints.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--canvas` | `#F7F7F5` | `#0E0E0D` | Page background |
| `--surface` | `#FFFFFF` | `#161615` | Cards, top nav, tab bar |
| `--surface-2` | `#F9F9F8` | `#1A1A19` | Inset wells: source banner, "from" side of a move diff |
| `--hover` | `#F3F3F1` | `#1F1F1D` | Row/ghost hover, search field fill, segmented track |
| `--pressed` | `#ECECE9` | `#262624` | Active/pressed fill |
| `--border` | `#E6E6E3` | `#2A2A27` | Card outlines, diff and list boxes |
| `--divider` | `#EFEFEC` | `#222220` | Lines inside cards |
| `--border-strong` | `#D3D3CF` | `#3A3A36` | Secondary-button outline, role-timeline rail, chip outline |
| `--control` | `#949089` | `#6E6D67` | Form-control boundaries, past-role dots, gantt fills (≥ 3:1 for UI) |
| `--fg-1` | `#1A1A18` | `#EDEDEA` | Names, titles, body, numbers |
| `--fg-2` | `#5C5B57` | `#A9A8A2` | Secondary lines, meta, inactive nav |
| `--fg-3` | `#6F6E69` | `#8C8B85` | Captions, durations, footnotes, placeholders |
| `--accent` | `#4352D1` | `#4F5DDB` | **Iris.** Primary button fill, unread count, focus ring |
| `--accent-hover` | `#3A47B8` | `#4553D2` | Primary hover |
| `--accent-subtle` | `#EEF0FC` | `#1C1F3A` | Focus halo on the search field |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` | Text/icons on accent |
| `--link` | `#4352D1` | `#8F9AFF` | Inline links ("Explore tree", "All moves") |
| `--org-bg` / `--org-fg` | `#F0F0EE` / `#45443F` | `#1F1F1D` / `#C9C8C2` | Organization tiles |
| `--bar` / `--track` | `#5C5B57` / `#EFEFEC` | `#A9A8A2` / `#262624` | Data bars (carousel tracker) |

There is no red, green or yellow in the core palette. Status is carried by icons, words and position. If the product later needs a destructive color, add a single `--danger` (`#B42318` / `#F97066`) for destructive confirmations and form errors only.

### 2.2 Contrast (WCAG 2.1)

All text pairs meet AA (4.5:1) at body sizes; UI boundaries meet 3:1.

| Pair | Light | Dark |
| --- | --- | --- |
| `fg-1` on `surface` / `canvas` | 17.43 / 16.25 | 15.44 / 16.47 |
| `fg-2` on `surface` / `surface-2` / `hover` | 6.80 / 6.45 / 6.12 | 7.60 / 7.31 / 6.93 |
| `fg-3` on `surface` / `canvas` / `hover` | 5.11 / 4.76 / 4.60 | 5.30 / 5.65 / 4.83 |
| `link` on `surface` / `canvas` | 6.24 / 5.82 | 7.10 / 7.57 |
| `on-accent` on `accent` / `accent-hover` | 6.24 / 7.57 | 5.36 / 6.14 |
| `org-fg` on `org-bg` | 8.55 | 9.85 |
| `control` on `surface` (UI, 3:1) | 3.18 | 3.49 |
| `accent` focus ring on `surface` (UI, 3:1) | 6.24 | 3.38 |

### 2.3 People tints

Initials sit on one of six soft tints. The tint is picked by FNV-1a (32-bit) over the person's slug, `mod 6`, so a person keeps the same color everywhere. Tints are identity, not meaning: never use them for status.

| | Light bg / fg | Contrast | Dark bg / fg | Contrast |
| --- | --- | --- | --- | --- |
| `c1` Slate | `#E5E9F0` / `#3B4A63` | 7.35 | `#222833` / `#AFC0DA` | 8.01 |
| `c2` Sage | `#E3EDE6` / `#2F5A3F` | 6.60 | `#1D2A22` / `#A3CCAF` | 8.40 |
| `c3` Sand | `#F1EADF` / `#6A4C1F` | 6.59 | `#2E2719` / `#DDC59A` | 8.82 |
| `c4` Clay | `#F3E5E3` / `#7A3A33` | 6.90 | `#33201E` / `#E3AFA7` | 8.02 |
| `c5` Plum | `#EDE6F0` / `#5A3D6B` | 7.42 | `#2B2131` / `#CDB3DC` | 8.12 |
| `c6` Teal | `#DFEDEE` / `#1F5A5F` | 6.51 | `#172A2C` / `#9ACED2` | 8.64 |

The tints are deliberately kept away from Iris, so an avatar never reads as a button.

---

## 3. Typography

**Family:** Inter (variable, with optical size) from Google Fonts, `opsz 14..32, wght 400..700`. Fallback: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.

**Features:** `cv11` on everywhere (single-storey *a*: a little friendlier than default Inter at the same density). `tabular-nums` on every number that can sit in a column: seasons, ranges, counts, KPIs.

| Role | Size / line | Weight | Tracking | Where |
| --- | --- | --- | --- | --- |
| Display | 24 / 32 | 600 | −0.02em | Profile name (phone: 20 / 28) |
| Stat | 20 / 28 | 600 | −0.015em | Header stats, tracker KPIs (phone: 18 / 24) |
| Title | 16 / 24 | 600 | −0.01em | Card titles ("Experience") |
| Subtitle | 15 / 20–22 | 400–600 | −0.01em | Headline under name, job title, mini-profile name |
| Body | 14 / 20 | 400 | 0 | Default; long prose uses 14 / 22 |
| Body strong | 14 / 20 | 500–600 | 0 | Role titles (500), names and org names (600) |
| Small | 13 / 18 | 400–500 | 0 | Meta lines, buttons, nav labels, ranges |
| Caption | 12 / 16 | 400–600 | 0 | Durations, context lines, chips, footnotes |
| Micro | 11 / 12–16 | 500 | 0 | Tab-bar labels, `kbd` hints only |

Rules: sentence case everywhere, no all-caps labels, and no italics (quotes use a left rule instead). Long text wraps with `text-wrap: pretty` so no line ends on a single orphaned word. Prose is capped at 68ch.

---

## 4. Spacing, radii, elevation

**Spacing (4 px base):** `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`.

- Card padding: 20 × 24 (desktop main), 16 (rail cards, feed items, all phone cards).
- Gap between cards: 12 desktop, 8 phone. Column gutters: 24.
- Inside a list: rows are separated by a 1 px `--divider` with 12 px above and below. Never stack padding and margin.
- Text column alignment: everything that follows a 40 px avatar or tile starts at **52 px** (40 + 12). Feed bodies, role rows and action bars all share that line.

**Radii:** `4` chips and `kbd` · `6` buttons, inputs, segmented control, org tiles (32 px), diff boxes · `8` cards and 40 px org tiles · `12` sheets and dialogs · `50%` avatars only. **People are circles; organizations are rounded squares.** Never mix them.

**Borders & elevation:**

| Level | Treatment | Use |
| --- | --- | --- |
| 0 | `--canvas` | Page |
| 1 | `--surface` + 1 px `--border` | Cards, nav, tab bar |
| 1-inset | `--surface-2` + 1 px `--divider` top | Banners inside cards, "before" cell of a diff |
| 2 | `--surface` + `0 0 0 1px rgba(26,26,24,.06), 0 8px 24px -6px rgba(26,26,24,.16)` | Menus, typeahead, toasts (dark: `.6` black, white 6 % ring) |

Secondary buttons get a 1 px `rgba(26,26,24,.04)` drop in light mode only, just enough to sit on the page.

---

## 5. Layout

### Desktop (≥ 1081 px)

Content max width **1152 px** (container 1200 with 24 px side padding), centered. Top nav 52 px, sticky.

| Page | Columns | Widths |
| --- | --- | --- |
| Feed | left rail / center / right rail | **232 / 1fr (≈ 568) / 304**, gutters 24 |
| Profile, program, job detail | main / right rail | **1fr (≈ 808) / 320**, gutter 24 |
| Search | facets / results / (none) | 232 / 1fr |

Rails are `position: sticky` 24 px below the nav. Main column content never exceeds 808 px.

### Tablet (721–1080 px)

Feed drops the left rail (the mini-profile moves to the Me menu); right rail narrows to 280. Profile rail narrows to 280, the career gantt hides, the tree list goes to one column.

### Phone (≤ 720 px, designed at 390)

- **Top bar 48 px:** avatar (Me menu) · search field (flex) · messaging icon with count.
- **Bottom tab bar 56 px + safe area:** Home · Network · Jobs · Alerts · Me (avatar). Fixed to the viewport.
- Cards go full-bleed (no radius, no side borders), separated by 8 px of canvas. Inner padding 16, which gives the 16 px side gutter.
- Right-rail content either moves inline (a compact *Carousel tracker* card at the top of the feed) or below the main column ("Same tree"). Low-value rail content ("People also viewed") is dropped.
- Ledger columns collapse under the title as `2010–2019 · 10 seasons`.
- Conference names collapse to abbreviations (`NWC`).

---

## 6. Components

### Top nav (desktop)

52 px, `--surface`, 1 px bottom border. Left: mark (22 px ink square with a three-node tree glyph) + wordmark 15/650. Then the search field, 296 px. Right: **Home, Network, Jobs** as 16 px icon + 13/500 label; **Messaging, Notifications** as 32 px icon buttons with count badges. Then a vertical hairline, **For employers** (text), and the avatar + chevron (Me menu). Active item: `--fg-1` text plus a 2 px ink bar flush with the bottom border. Inactive: `--fg-2`. The active indicator is ink, not Iris.

### Bottom tab bar (phone)

Five equal columns, 22 px icons at 1.6 stroke, 11/12 labels. Active: `--fg-1`, 600 label, 2.1 stroke. Inactive: `--fg-3`. Count badges sit at the icon's top-right. No active background pill.

### Search field

32 px, radius 6, `--hover` fill, no border at rest; 1 px `--border` on hover. On focus: `--surface` fill, 1 px Iris border and a 3 px `--accent-subtle` halo. 16 px search icon in `--fg-3`, placeholder "Search coaches and programs", and a `/` `kbd` hint on desktop. The typeahead panel is elevation 2 and groups results as **People** and **Programs**: avatar or tile 24, name, one line of context, ↵ hint on the active row.

### Card

`--surface`, 1 px `--border`, radius 8. Header row: title 16/600 on the left; a count (`--fg-3`, 13) or one Iris link on the right, baseline-aligned. A card has at most one link-style action in its header.

### Buttons

| Variant | Spec | Use |
| --- | --- | --- |
| Primary | 32 px, Iris fill, white 13/500, radius 6, 12 px padding | One per view (Connect, Post job, Apply) |
| Secondary | 32 px, `--surface`, 1 px `--border-strong`, `--fg-1` | Message, Claim profile, View job |
| Ghost | 32 px, transparent, `--fg-2` → hover `--hover` + `--fg-1` | Feed actions (Congratulate, Message, Share) |
| Icon | 32 or 28 square, secondary or ghost | More (`…`), Save, Connect in rails |
| Small | 28 px | Inside banners and rails |

Phone: header actions grow to 36 px and share the row. Focus is a 2 px Iris outline at 2 px offset on every variant.

### Chips & badges

20 px tall, radius 4, 12/500, 6 px side padding.

- **Neutral** (`--hover` fill, `--fg-2`): division (`NCAA D-III`), role group.
- **Abbreviation** (same, 600, +0.02em tracking): conference (`NWC`), with the full name in `title`.
- **Outline** (inset 1 px `--border-strong`): state, e.g. `Unclaimed`.
- **Sample** (1 px *dashed* `--control`): `Sample listing`. The dashed edge means "not real" without a new color.
- **Count badge:** 16 px pill, Iris fill, white 10/600, 2 px `--surface` ring.

### Profile header

- Avatar 80 (phone 64), then name 24/600 with an `Unclaimed` chip, then the headline 15/22 ("Head Football Coach at Pacific University (Oregon)", org linked), then the meta row: pin + city, conference chip, division chip.
- Actions top-right (phone: full-width row): **Connect** (primary), **Message**, **More**.
- **Stats strip:** a hairline on top, then four equal columns split by hairlines: *Seasons coached · Coaching stops · In coaching tree · First season*. Stat 20/600 tabular over a 12 px label. The tree count links to the tree. Phone shows the first three.
- **Source banner (unclaimed):** a full-bleed band at the bottom of the header card, `--surface-2`, with an info icon and "Built from public sources:" plus source links, set in `--fg-1` 500 with an external-link glyph. Right side: "Is this you?" + **Claim profile** (small secondary with a shield icon). It is neutral on purpose: an unclaimed profile is normal, not an error.

### Experience group (role progression + season ranges)

Each organization is one group, separated by a hairline.

- **Group header:** org tile 40, org name 14/600 (linked), meta 13 `--fg-2` ("NCAA D-III · Northwest Conference · Forest Grove, OR"). Right side, the **ledger**: a 100 × 6 px career gantt (this org's seasons inside the whole career span; past = `--control`, current = `--fg-1`), then a 112 px right-aligned range block (`2010–Present` 13/500 tabular over `17 seasons` 12 `--fg-3`).
- **Roles:** listed newest first under the header. A 40 px rail column carries an 8 px dot per role: filled ink = current, hollow `--control` ring = past. Dots are joined by a 1 px `--border-strong` line. A **dashed** segment marks time away between two stints at the same org. Role title 14/500, a one-line note 13 `--fg-2`, and its own ledger range on the right.
- **Single-role org:** collapses to one row (LinkedIn pattern). The role title is the main line and the org becomes part of the meta.
- **Inferred years:** dotted underline in `--control` with the reasoning in `title` ("Inferred from 'two years' between…").
- **Evidence:** an optional disclosure, "› Evidence". Open, it shows the verbatim quote with a 2 px left rule and a source line (`goboxers.com · Ian Falconer bio`).
- **Legend:** a footnote row at the bottom of the card covering Current, Past role, Time away, Year inferred and Share of career. It shows only where those marks appear.

### Coaching tree mini-list

Card header "Coaching tree" + **Explore tree →**. A segmented control picks the relationship: *Worked under · Worked alongside · Coached under {first name}*, with tabular counts. It defaults to the largest group. On phone the labels become *Mentors · Peers · Mentees*. Below it, a two-column list (one column under 1080 px). Each row: avatar 36, name 14/600, current title 13 `--fg-2` (one line, truncate), and on the right the overlap as a ledger (`2020– / 7 seasons`). A footnote explains the derivation ("Derived from overlapping seasons at Pacific").

### Feed item

Card, 16 px padding. Header grid: avatar 40 (a person) or tile 40 (a program) · sentence · `…` menu.

- **Sentence:** 14/20, with names and orgs in 600 as links. Grammar: "{Person} joined {Org} as {Role}", "{Person} was promoted to {Role} at {Org}", "{Org} named two coordinators", "{Person} is in his 42nd season on the {Org} staff".
- **Meta:** 12 `--fg-3`. A kind label with a 12 px icon in `--fg-2` 500 (New hire ⟶ `log-in`, Promotion ⟶ `chevrons-up`, Milestone ⟶ `flag`, Job ⟶ `briefcase`), then conference, then season. We show **"2026 season"**, not "2d ago", because announcement dates aren't in the source data.
- **Move diff:** a bordered box with two cells. **From** sits on `--surface-2` in `--fg-2`; **To** sits on `--surface` in `--fg-1`, with a 20 px arrow disc on the seam. Each cell holds a tile 32 (omitted for same-org promotions), org 13/600 and role 12, with the year never truncated. On phone the cells stack and the arrow points down.
- **Context:** optional one line, 13 `--fg-2`, sourced from the bio ("Former NFL quarterback with the Broncos, Texans, Cardinals and Cowboys").
- **Grouped hires:** multiple people in one item use a bordered list of people rows instead of a diff.
- **Milestone:** a bordered box with a 28/600 tabular number and label, a hairline, then the facts.
- **Action bar:** ghost buttons aligned to the 52 px text column: Congratulate · Message · Share. The source domain sits right-aligned in `--fg-3` with a link icon. On phone the buttons go icon-only, 40 px wide.

### Job card

Same frame as a feed item. Meta row first (Job · reason it matches), then the title 15/600 (linked) and org · city · conference · type in 13 `--fg-2`. Chips: `Sample listing` (dashed) when demo, then role group and division. Network proof: up to three 24 px avatars spaced 4 px apart (never overlapped, so the initials stay readable), then one sentence ("Your colleagues John Bates and Nic Brockhoff played here"). Actions top-right: Save (icon) and **View job** (secondary). Apply is primary on the detail page only.

### Rail lists (Same tree, People you may know, People also viewed)

Avatar 36 (32 for passive lists), name 13/600, title 12 `--fg-2` (truncate), and a context line 12 `--fg-3` with an icon for the reason (`network` for tree adjacency, `graduation-cap` for alma mater). The context line follows the pattern **"Via {person} · {place}"**. The Connect icon button (28, secondary) sits top-right. Passive lists have no buttons; the whole row is the link.

### Carousel tracker

Title + season chip, then the scope line ("Division III · 13 programs with staff data"). A three-up KPI strip (Hires · Promotions · Open jobs) is bleed-to-edge with hairline separators. Below it, "Hires by conference" as bar rows: label 76 px, a 6 px bar (`--bar` on `--track`, scaled to the max), and the count right-aligned and tabular. The footer holds a caveat footnote and **All moves →**. On phone it collapses to a single tappable summary card at the top of the feed.

### Tabs

- **Page tabs** (program page: Staff · Alumni coaches · Jobs): 40 px tall, 13/500 `--fg-2`. The active tab is `--fg-1` with a 2 px ink underline flush with the card's hairline, same as the top nav.
- **Segmented control** (in-card filters, feed filter): a 2 px-padded `--hover` track, 28 px segments, active segment `--surface` with a 1 px `--border` ring. On phone it spans the full width with equal segments.

### Empty states

These sit inside the card that would hold the content, never as a full page. Use a 20 px Lucide icon in `--fg-3`, one 14/500 sentence that states the fact, one 13 `--fg-2` line on what happens next, and at most one secondary button. No illustrations. Examples:

- Tree, *Worked under*, empty: "No mentors on {Brand} yet." / "Mentors appear when someone Ian worked under has a profile." / **Invite a mentor**.
- Feed filtered to *Jobs*, empty: "No open jobs match Division III right now." / "We'll show new openings here first." / **Set a job alert**.
- Search, no results: "No coaches or programs match 'xyz'." / "Try a last name, a school, or a conference abbreviation."

---

## 7. Iconography

**Lucide** (ISC license, lucide.dev), outline only, on its 24 px grid. Sizes are 12 / 14 / 16 / 20 / 22 px with stroke 2 / 1.9 / 1.75 / 1.75 / 1.6, so the visual weight stays even across sizes. Icons inherit `currentColor`. Inline-SVG sprite in the mockups, `lucide-react` in the app.

| Concept | Icon |
| --- | --- |
| Home / Network / Jobs / Messaging / Alerts | `house` / `users` / `briefcase` / `message-square` / `bell` |
| Coaching tree, tree context | `network` |
| Alma mater, education | `graduation-cap` |
| New hire / Promotion / Milestone | `log-in` / `chevrons-up` / `flag` |
| Source link / external | `link` / `external-link` |
| Evidence quote | `text-quote` |
| Claim | `shield-check` |
| Connect | `user-plus` |
| Private setting | `lock` |

Never use a football, whistle, trophy, helmet, stadium or clipboard. The brand mark is a three-node tree (one node above two): it describes the network, not the sport.

---

## 8. Motion & capture

- 120 ms ease on color, background and border for hover/press. Disclosures rotate their chevron 90° in 120 ms. Menus fade + 4 px rise in 140 ms. Nothing else moves: no skeleton shimmer longer than a single pass, no parallax, no confetti on "Congratulate".
- Everything is disabled under `prefers-reduced-motion`.
- **Capture aid:** `#fullpage` in the URL pins the phone tab bar to the end of the document. Chromium full-page screenshots otherwise draw `position: fixed` elements at the 844 px mark, mid-page. It changes nothing for real users. `#dark` / `#light` force a theme the same way.

---

## 9. Do / Don't

| Do | Don't |
| --- | --- |
| Right-align season ranges in a tabular column | Put dates in prose ("from 2010 until 2019") where a ledger fits |
| Use one primary (Iris) button per view | Make Connect, Claim and Apply all primary on one screen |
| Separate with 1 px hairlines and canvas | Add drop shadows to cards, or gradients anywhere |
| Use initials on a soft tint | Use photos, logos you don't have rights to, or emoji |
| Say where data came from and when it's inferred | Present derived or sample data as confirmed |
| Write "2026 season" when the date is unknown | Invent "2d ago" timestamps |
| Explain every suggestion ("Via Rob Hutchins · Colorado") | Show "People you may know" without a reason |
| Keep status in words and icons | Introduce green/red/yellow for status |
| Use abbreviations with the full name in `title` (NWC) | Spell out conferences where space is tight on phone |
| Truncate long titles with an ellipsis but never the year | Let a range or season count be cut off |
| Use people = circles, organizations = rounded squares | Put a program in a circle or a person in a square |
| Use sentence case, 600 for names, 500 for roles | Use ALL-CAPS overlines or italics for emphasis |
