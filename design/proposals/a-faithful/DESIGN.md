# Direction A: LinkedIn-faithful

The product name is a placeholder that lives in one constant, `BRAND.name` (in the mockups, the `BRAND` object at the bottom of each HTML file; in the app, `web/src/lib/brand.ts`). Nothing else in this document or the mockups hard-codes it.

**The idea:** coaches, athletic directors and HR staff already know how LinkedIn works. This direction keeps that layout on purpose: white cards on a soft warm-gray canvas, a 3-column shell, and a compact top nav with an icon above each label. It earns its own identity in two ways. The first is a single Evergreen accent, a color no other professional network uses. The second is coaching-native detail on every surface: season ranges, conference and division badges, coaching-tree counts, role progressions within a program, and a source link for every stint we did not get from the coach.

Files in this folder:

| File | What it is |
| --- | --- |
| `profile.html` | Coach profile `/in/ian-falconer` (unclaimed), app shell, right rail. Responsive. |
| `feed.html` | Signed-in home feed (demo account: Evan Durand, Kean). Responsive. |
| `profile-1440.png`, `feed-1440.png` | Desktop, 1440 × 900 viewport, full page. |
| `profile-390.png`, `feed-390.png` | Phone, 390 × 844, the first screen with the bottom tab bar. |
| `profile-390-full.png`, `feed-390-full.png` | Phone, the whole scroll height, for review. |

All content comes from the pilot extraction (`pacific_or.json`, `kean.json`, `brevard.json`, `mit.json`, `norwich.json` and others). Stints are shown exactly as extracted. Moves are phrased from real stints: a stint starting in 2026 is shown as "joined", and a new role at the same program as "promoted". Profile-view counts in the mini-profile and the sample job are demo values, and the job is labeled *Sample listing*.

---

## 1. Principles

1. **Familiar first.** Use the layout people already know: the same shell, card rhythm and controls as LinkedIn. Spend the novelty budget on coaching data, not on chrome.
2. **Every pixel carries information.** Nothing is decorative: no gradients, textures, photos or sports imagery. A divider separates content, a badge classifies it, and color signals that something is interactive or current.
3. **One accent, used sparingly.** Evergreen appears only on primary actions, links, selected states, the "current" marker and the brand mark. If a screen has more than about five green elements, something is wrong.
4. **Show where it came from.** Unclaimed data says so, links to its source and marks inferred years. Sample data is labeled. Trust beats polish.
5. **Dense, not crowded.** Use a 14 px body, tight but regular spacing (4 px base, 8 px between cards, 24 px inside them) and clear text tiers (primary, secondary, caption). Cut copy before cutting whitespace.

---

## 2. Color

### Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--canvas` | `#F3F2EF` | `#0E1012` | Page background behind cards |
| `--surface` | `#FFFFFF` | `#181B1E` | Cards, top nav, tab bar |
| `--surface-2` | `#F7F6F3` | `#202427` | Source banner, search field, quiet wells |
| `--hover` | `#EFEEEA` | `#262A2E` | Hover fill for rows, ghost buttons, card footers |
| `--pressed` | `#E6E5E0` | `#2E3337` | Active/pressed fill |
| `--border` | `#E0DFDA` | `#2E3337` | Card and box outlines (1 px) |
| `--divider` | `#EBEAE6` | `#262A2E` | Lines inside cards, timeline rails |
| `--border-strong` | `#8C9094` | `#6B7277` | Outlined neutral buttons, filter chips, past-role dots (meets 3:1 for UI) |
| `--cover` | `#E4E8E5` | `#22282A` | Flat profile cover band (never an image or gradient) |
| `--text-1` | `#191C1F` | `#E8EAEB` | Names, titles, body |
| `--text-2` | `#55595D` | `#AEB4B9` | Secondary lines, meta, captions, inactive nav |
| `--text-3` | `#646A6E` | `#959CA2` | Separators (·), counts in tabs, quiet glyphs only |
| `--accent` | `#0B6B53` | `#4CC09C` | Evergreen. Primary button, links, selected tab/chip, current-role dot, unread badge, brand mark |
| `--accent-hover` | `#08533F` | `#6FD0B1` | Hover/pressed for accent |
| `--accent-tint` | `#E3EFEA` | `#173229` | Secondary-button hover fill, halo around the current-role dot |
| `--on-accent` | `#FFFFFF` | `#06140F` | Text/icons on accent fills |
| `--sample-bg` / `--sample-fg` | `#FBF1DE` / `#7A4B00` | `#33280F` / `#F2C879` | The "Sample listing" chip only |
| `--danger` | `#B42318` | `#F97066` | Destructive actions and form errors only |
| `--org-bg` / `--org-fg` | `#ECEBE7` / `#3C4044` | `#2A2E31` / `#D4D8DB` | Program marks (initials in a rounded square) |

**Identity tints for people** (initials on a circle; pick by a stable hash of the person id, `id mod 6`):

| | Light bg / fg | Dark bg / fg | Contrast L / D |
| --- | --- | --- | --- |
| `av-1` slate | `#E2E8EE` / `#2C3E50` | `#26313B` / `#C9D6E2` | 8.90 / 8.96 |
| `av-2` sand | `#EDE6DA` / `#5B4424` | `#352D22` / `#E3D2B6` | 7.37 / 9.14 |
| `av-3` sage | `#DFEAE3` / `#2D4B3B` | `#213229` / `#BFDCCB` | 7.80 / 9.22 |
| `av-4` clay | `#F0E2DC` / `#6B3324` | `#3A2722` / `#EDC6B9` | 7.82 / 8.96 |
| `av-5` iris | `#E6E4F0` / `#3E3868` | `#2B2940` / `#CFCBEF` | 8.49 / 9.00 |
| `av-6` steel | `#DCE8EE` / `#21485A` | `#1F323B` / `#BAD9E6` | 7.86 / 8.97 |

The tints are deliberately muted, so a page full of avatars still reads as calm. People are always circles and programs are always neutral squares. That shape rule lets you tell a person from a program at a glance.

### Contrast (WCAG 2.1, computed)

Every text pair meets AA (4.5:1) in both themes. Interactive outlines meet 3:1.

| Pair | Light | Dark |
| --- | --- | --- |
| text-1 on surface | 17.11 | 14.33 |
| text-1 on canvas | 15.29 | 15.80 |
| text-2 on surface | 7.06 | 8.26 |
| text-2 on canvas | 6.31 | 9.10 |
| text-2 on surface-2 | 6.54 | 7.47 |
| text-2 on hover | 6.08 | 6.90 |
| text-3 on surface | 5.48 | 6.22 |
| text-3 on canvas | 4.90 | 6.86 |
| text-3 on surface-2 | 5.08 | 5.63 |
| accent on surface (links) | 6.48 | 7.68 |
| accent on canvas | 5.79 | 8.47 |
| accent on surface-2 (source links) | 5.99 | 6.94 |
| accent on accent-tint | 5.49 | 6.12 |
| on-accent on accent (primary button) | 6.48 | 8.37 |
| on-accent on accent-hover | 9.05 | 10.17 |
| sample-fg on sample-bg | 6.61 | 9.17 |
| org-fg on org-bg | 8.76 | 9.55 |
| border-strong on surface (UI, 3:1) | 3.21 | 3.54 |

Rule: `text-3` is never used for words a user must read on `accent-tint`. Use `text-2` there.

### Where the accent may appear

- the one primary button in a view (Connect on a profile; nothing on the feed, where actions are quiet)
- text links ("12 in coaching tree", "Explore tree", source links, "Set up")
- selected states: the in-content tab underline and the selected filter chip
- the current-role dot in a timeline, and "your conference" in the tracker bars
- the brand mark and the unread count dot

Never on large surfaces, card backgrounds, headings or icons that are not interactive. Active top-nav items use `text-1` with a 2 px `text-1` underline, as LinkedIn does, so the accent stays rare.

---

## 3. Typography

**Family:** Inter (Google Fonts, weights 400/500/600/700, `display=swap`), falling back to `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Inter is close to LinkedIn's system stack, so the product feels familiar. It also offers `tabular-nums`, which keeps season ranges and counts aligned. Turn on `cv05` (open lowercase l) so names like "Ian Falconer" read cleanly.

| Style | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `t-name` | 24 / 30 (phone 20 / 26), −0.012em | 600 | Profile name |
| `t-title` | 20 / 28 (phone 18 / 24), −0.008em | 600 | Card titles: About, Experience |
| `t-subtitle` | 16 / 22 | 600 | Organization name, single-role title, job title, mini-profile name |
| `t-lead` | 16 / 24 | 400 | Profile headline |
| `t-body` | 14 / 20 | 400 | Body, feed text, descriptions |
| `t-strong` | 14 / 20 | 600 | Role titles, person names in lists, banner lead |
| `t-meta` | 14 / 20 | 400, text-2 | Season ranges, org meta lines |
| `t-caption` | 12 / 16 | 400, text-2 | Rail meta, tree context, timestamps, footnotes |
| nav label | 12 / 16 | 400 | Top nav labels |
| tab-bar label | 11 / 14 | 500 (600 active) | Phone tab bar only |
| badge | 12 / 16 (11 inside move boxes) | 600, +0.01em | Division/conference badges |
| stat number | 16 / 22 to 20 / 28 | 600, tabular | Tracker and tenure stats |

Rules: use only two weights in any one block (400 and 600). No all-caps labels. Use sentence case everywhere ("Coaching tree", not "Coaching Tree"). Numbers that change or compare use `.num` (tabular). Use an en dash for ranges (2010–2019) and a middle dot with spaces for separators (2010–2019 · 10 seasons).

---

## 4. Spacing, radii, elevation

**Spacing scale (px):** 2, 4, 6, 8, 12, 16, 20, 24, 32, 48. Nothing else.

| Where | Value |
| --- | --- |
| Gap between stacked cards | 8 |
| Gap between columns | 24 |
| Card padding, desktop | 20 top, 24 sides and bottom (rail cards 16) |
| Card padding, phone | 16 |
| Card title to first content | 12 |
| Rows inside a list (people, groups) | 12 above and below, plus a 1 px divider |
| Avatar to text | 12 (8 in compact rows) |
| Inline meta separator | middle dot, 5 px each side |
| Page top padding | 24 desktop, 8 phone |

**Radii:** card 8; program mark 6 (4 at 32 px and below); badge 4; search field 6; buttons, chips and the composer pill 999 (fully round, as in LinkedIn); people 50%.

**Elevation:** flat. Cards use a 1 px `--border` and no shadow. Only floating layers (menus, typeahead, toasts) get `--shadow-pop` (`0 4px 12px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.06)`). The top nav and tab bar are separated by a 1 px border, never a shadow. Focus: a 2 px surface gap plus a 2 px accent ring (`--focus-ring`) on every interactive element.

---

## 5. Layout grid

### Desktop (≥ 992 px)

- Container: 1128 px content width, centered, with 24 px gutters (max 1176 px total).
- **Feed:** `225 | 555 | 300` (left rail, center, right rail) with 24 px gaps.
- **Profile, program, job detail:** `804 | 300` (main, rail) with 24 px gaps.
- **Top nav:** 52 px tall, sticky, `--surface` with a 1 px bottom border.
- Rails scroll with the page in these mockups. In the app, the left rail and the bottom of the right rail may stick at `top: 76px`.

### Tablet (768–991 px)

- Feed: `225 | 1fr`. The right rail drops out, and its tracker moves into the strip used on phone.
- Profile: a single column, max 760 px, with rail cards stacked after the main cards.
- Top nav: the wordmark hides and only the brand mark shows; nav labels hide (labels stay for Me and For employers); search narrows to 200 px. The feed's sort control moves into the filter sheet.

### Phone (< 768 px), designed at 390 × 844

- **App shell:** the top bar (52 px) and the bottom tab bar (56 px plus safe area) are fixed rows. Only the middle scrolls.
- Top bar: own avatar (32, opens the Me menu), a full-width search field (36 px), and a Messaging icon button.
- Bottom tab bar: Home, Network, Jobs, Messages, Alerts. Icons are 24 px with 11 px labels. The active tab shows `text-1` with a 2 px top indicator. Notifications reuse the accent count dot.
- Cards run edge to edge: no side borders, no radius, 8 px gaps showing canvas between them. Padding is 16.
- The feed loses its left rail (the mini-profile lives behind the avatar). The right rail collapses into a one-line **Carousel tracker** strip above the filter chips.
- The profile shows its rail cards (Current program, Same tree, People also viewed) after Education.
- Tap targets are at least 40 px. Feed actions stack the icon over a 12 px label.

---

## 6. Components

All sizes are in px. Each class name matches the mockup CSS.

### Top nav (`.topnav`)
52 tall, in this order: brand (32 accent square with the tree mark, then a 16/700 wordmark from `BRAND.name`), search (280 × 34, `surface-2`, 1 px border, 6 radius, 16 px search icon, placeholder "Search coaches and programs"), then the nav items pushed right. Each item is min 76 wide, with a 24 icon over a 12/16 label, colored `text-2` (`text-1` on hover). The active item is `text-1` with a 2 px `text-1` bar on the bottom edge. The Me item uses the 24 avatar with a chevron. A 1 × 36 divider precedes **For employers** (layout-grid icon). The unread dot is a 16 px accent pill with 11/700 white numerals and a 2 px surface ring. Typeahead (not mocked): a `--shadow-pop` panel 400 wide, split into two groups (People, Programs) with 40 px rows; each row shows an avatar or program mark, the name, and the current role or conference.

### Bottom tab bar (`.tabbar`, phone only)
5 equal columns, 56 tall plus safe area, `surface` with a 1 px top border. The active tab uses `text-1` at weight 600 with a 32 × 2 indicator on the top edge.

### Card (`.card`)
`surface`, 1 px `border`, 8 radius. Header (`.card-head`): a title on the left and an optional caption or link on the right, baseline-aligned. Footer (`.card-foot`): a full-width 44 px link in `text-2` at weight 600 ("Show all 11 →") with a hover fill. Card footers never use the accent. One topic per card.

### Profile header (`.ph`)
- Flat 96 px cover band (`--cover`; 64 on phone). It carries no imagery and no upload prompt for unclaimed profiles.
- Avatar: 136 circle (96 on phone) overlapping the cover by 72, with a 4 px surface ring.
- Left column: name (`t-name`) with an **Unclaimed** chip; headline (`t-lead`: "Head Football Coach at Pacific University (Oregon)"); a meta row with a map-pin, the city and state, then division and conference badges; and a **stats line**: "**4** coaching stops · **25** seasons coached · **12 in coaching tree**". The tree count is the only link, the coaching equivalent of LinkedIn's connection count. On phone the labels shorten to "4 stops · 25 seasons · 12 in tree".
- Right column (desktop only): current program and alma mater, each a 32 program mark with a 14/600 name.
- Actions: **Connect** (primary), **Message** (secondary), **More** (tertiary). On phone, all three are 36 tall and share the full width.

### Unclaimed source banner (`.source`)
A full-bleed band inside the header card, below the actions: `surface-2` with a 1 px top divider and a 20 px info icon. It reads: "**This profile was built from public sources.** It has not been claimed yet." Below that, 12/16 source links in accent with an external-link icon (one per source domain), then "Checked Oct 2026". On the right sits a **Is this you? Claim it** secondary small button, which wraps under the text on phone. It is never dismissible for visitors. Once the profile is claimed, the band disappears and a claimed badge-check icon (`text-2`) appears next to the name.

### Experience group (`.exp`, `.exp-group`, `.role`)
- **Multiple roles at one org (grouped):** a 48 program mark; the org name (`t-subtitle`, a link) followed by division and conference badges; then a meta line "17 seasons · 2 roles · Forest Grove, Oregon" (use "2 stints" when the roles are not continuous). Below that is the role timeline, with dots centered in the 48 px logo column. Each role shows its title (`t-strong`), a season range (`t-meta`, tabular: "2020–present · 7 seasons") and an optional one-line description. Past dots are 8 px `border-strong`. The current role's dot is accent with a 3 px `accent-tint` halo. A 2 px `divider` rail joins the dots.
- **Single role:** follows LinkedIn's single-position form. The role title (`t-subtitle`) comes first, then the org name and badges, then "2004–2005 · 2 seasons · Oberlin, Ohio".
- Groups are separated by a 1 px divider inset to the text column (60 px). Order is reverse-chronological by each group's latest season.
- **Season math:** a range is first and last season inclusive (a season is the fall year). The count is `last − first + 1`. "present" means the current season.
- **Inferred years** (`years_explicit = false`) get a dotted underline and a tooltip: "Inferred from the source bio". The card ends with a one-line caption explaining the convention.
- The header caption gives the totals: "25 seasons · 4 programs".

### Coaching tree mini-list (`.tree`)
The title "Coaching tree" with an **Explore tree →** link. The subtitle "12 coaches, from overlapping seasons on the same staff" explains where the numbers come from. Three in-content tabs carry counts: **Coached under him 11 | Worked under 1 | Worked alongside 1** (on phone: "Coached under | Worked under | Alongside"). Below is a two-column grid (one column on phone) of up to 6 people (4 on phone). Each shows a 48 avatar, the name, "Role, Program" in 12/16, and a relationship line in 12/16 `text-2`, such as "On his staff since 2020" or "Played for him 2024–2025". Footer: "Show all 11 →". Pronouns come from the profile; when none is set, use "Coached under them".

### Feed item (`.card` with `.fi-*`)
- An optional **context bar** (12/16, 14 icon, 1 px divider below) says why the item is shown: "**Your head coach** · you have worked under him since 2022", "**NEWMAC** · a conference you follow". Use it only when the reason is real and specific.
- **Actor row:** a 48 avatar (or a program mark for staff updates), then a headline sentence with names and programs bold and linked: "**Tanner Kingsley** joined **MIT** as Offensive Coordinator / Quarterbacks". Under it, a 12/16 meta line: **type** (Hire, Promotion, Milestone, Staff update, New job, in `text-1` at weight 600) · conference · season · source domain with an external-link icon. An overflow (ellipsis) button sits top right.
- Bodies by type:
  - **Move box** (hire): a bordered 8-radius box with From → To columns. Each column has a 32 program mark, a "From"/"To" caption, the org with a level badge, and "Role · season". The columns stack on phone.
  - **Promotion ladder:** the experience timeline in miniature, with years right-aligned and the current role bold with the accent dot.
  - **Staff update:** a bordered list of new hires. Each row has an avatar, name, new title, a "Previously …" line, and a Connect tertiary button (icon-only on phone).
  - **Milestone:** a 3-up stat box (20/600 number, 12 caption).
  - **Evidence quote** (optional): a 2 px left rule, the quote in `text-1`, and "From his MIT staff bio" in a caption.
- **Action bar:** Congratulate (handshake), Comment, Repost, Send. 40 tall and `text-2`, with the icon stacked over the label on phone. No engagement counts until they are real.

### Job card (`.job`)
A 48 program mark; the title (`t-subtitle`, a link); a **Sample listing** chip for demo data; the org with badges; a caption meta line "New job · New Ulm, Minnesota · Full-time · Posted 2 days ago"; then **View job** (secondary) and **Save** (tertiary with a bookmark icon). On the Jobs list page, the same card appears without a card border inside a list, with 1 px dividers between rows.

### Person row (`.person`)
Used in rails, the tree and PYMK: a 48 avatar, the name (14/600; accent with underline on hover), the role (12/16 `text-2`, clamped to 2 lines), a context line (12/16 with a 14 network icon when the context is tree-derived), then an optional `btn-tertiary btn-sm` **Connect**. Rows are separated by 1 px dividers.

### Carousel tracker (rail card)
The title with a "2026 cycle" caption; a 3-up stat box (Hires, Promotions, Open jobs); then "Hires by conference" as horizontal bars (6 px tall, `divider` track, `border-strong` fill). The viewer's own conference is bold with an accent bar, and nothing else in the card is accent. A caption names the data scope ("From staff pages at 14 programs; open jobs are sample listings"). Footer: "Open tracker →". On phone it becomes a single-line strip: title, "2026 cycle · 20 hires · 8 promotions · 3 open jobs", and a chevron.

### Mini-profile (feed left rail)
A 56 cover, a 64 avatar overlapping by 32, the name with a claimed check, the headline (12/16), and a caption line for location plus a conference badge. Below are stat rows (Profile viewers, Search appearances; 12/16 at weight 600 with right-aligned tabular numbers). An **Open to opportunities** block shows its state ("Off"), the promise "Tell chosen employers quietly. Your staff never sees it." and a **Set up** link. A shortcuts card follows: My coaching tree, Saved jobs, Programs you follow.

### Buttons (`.btn`)
| Variant | Spec |
| --- | --- |
| Primary | accent fill, on-accent text, 32 tall, 16 px side padding, pill, 14/600; hover accent-hover |
| Secondary | 1 px accent outline, accent text; hover accent-tint fill plus a 1 px inset (reads as a 2 px border) |
| Tertiary | 1 px border-strong outline, text-2; hover hover-fill plus a text-2 inset |
| Ghost | no border, text-2, 4 radius; used in the composer |
| Small | 28 tall, 12 px side padding |
| Icon button | 32 circle, text-2, hover fill |
Icons inside buttons are 16 px with a 2 stroke and a 6 px gap. Each view has at most one primary button.

### Chips and badges
- **Badge** (classification, not interactive): 20 tall, 4 radius, 1 px border, surface, 12/16/600 `text-2`. Examples: `D-III`, `NWC`, `UFL`, `High school`. The full name goes in `title`.
- **Status chip:** 22 tall pill, `surface-2`, 12/600. Examples: "Unclaimed", "Sample listing" (amber variant).
- **Filter chip** (interactive): 32 tall pill, 1 px border-strong, `text-2` at weight 600. Selected state: accent fill with on-accent text (the LinkedIn Jobs convention). On phone, the chip row scrolls horizontally.

### Search field
34 tall (36 on phone), `surface-2` fill, 1 px border, 6 radius, 16 px icon. Focus: surface fill with a `text-1` border. The placeholder names both object types.

### Tabs (in-content)
44 tall, 12 px side padding, 14/600 `text-2`, with the count in weight 400. Selected: accent text with a 2 px accent underline inset 8 px. A 1 px divider runs under the row. Tabs scroll horizontally on overflow and never wrap.

### Empty states
Inside the card that would hold the content, centered, with 32 padding: a 48 `surface-2` circle holding a 24 `text-2` Lucide icon, a 16/600 title, one 14/20 `text-2` sentence, and at most one secondary button. Copy states what is true and offers one useful action:
- Experience (unclaimed, no stints): "No coaching history found in public sources yet." [Suggest a stint]
- Coaching tree: "No overlapping staffs yet. Trees fill in as more programs are added." [Explore programs]
- Feed: "Follow programs and conferences to see their moves here." [Find programs]
- Jobs with filters: "No openings match these filters." [Clear filters]
Never use illustrations.

---

## 7. Iconography

**Lucide** (ISC license, lucide.dev), inlined as an SVG sprite with `<use href="#i-name">`. Stroke 1.75 at 20 and 24 px, and 2 at 16 px and below. Use `currentColor` only. Icons are never filled, never colored except by inheriting accent in links, and never decorative.

| Meaning | Icon |
| --- | --- |
| Home, Network, Jobs, Messaging, Notifications | `house`, `users`, `briefcase`, `message-square`, `bell` |
| For employers | `layout-grid` |
| Search, location, source link | `search`, `map-pin`, `external-link` |
| Connect, Message, Save | `user-plus`, `send`, `bookmark` |
| Tree relationship, program | `network`, `building-2` |
| Info / provenance, quote | `info`, `quote` |
| Congratulate, Comment, Repost | `handshake`, `message-circle`, `repeat-2` |
| Claimed profile | `badge-check` |
| Open to opportunities | `eye` |

**Brand mark:** a custom 24-grid glyph in the same 2 px stroke style. One node sits above two branches, a coaching tree. It contains no ball, whistle or field.

---

## 8. Motion

Keep it minimal and functional:
- color, background and shadow transitions on hover take 120 ms ease
- menus and the typeahead fade and translate 4 px over 150 ms ease-out
- tab underline: no slide; it switches instantly
- no skeleton shimmer; use static `surface-2` blocks while loading
- `prefers-reduced-motion: reduce` disables all transitions

---

## 9. Content rules (coaching-native)

- **Season ranges:** "2010–2019 · 10 seasons", "2003 · 1 season", "2020–present · 7 seasons". Always tabular, always with an en dash.
- **Titles:** keep the program's own wording on the profile. In dense contexts (rails, tree, feed boxes), use standard abbreviations: OC, DC, QB, OL, DL, LB, DB, ILB, HC, S&C.
- **Program names:** use the registry short name in dense contexts ("Pacific (OR)", "MIT") and the official name on the profile ("Pacific University (Oregon)").
- **Badges:** division (`D-III`, `D-I FCS`, `NAIA`, `High school`) and conference abbreviation (`NWC`, `NJAC`). Pro leagues use the league abbreviation (`UFL`).
- **Provenance:** every unclaimed stint links to its source. Mark inferred years. Summaries say they were written from the source bio.
- **Sample data:** every demo job carries the amber "Sample listing" chip. Demo stats are never presented as facts about a real person's career.
- **Do not editorialize:** "joined", "was promoted to" and "begins his 21st season" are statements of record. Avoid words like "big hire", "rising star" or rankings.

---

## 10. Do / Don't

| Do | Don't |
| --- | --- |
| Keep the LinkedIn shell: 1128 container, 8 px card gaps, 52 px nav, pill buttons | Invent new navigation patterns or floating action buttons |
| Use Evergreen for one primary action, links and selected states | Tint backgrounds, headings or icons green "for brand" |
| Show season ranges, badges and tree counts wherever a coach appears | Show a person without a current role and program |
| Use initials on muted tints for people and neutral squares for programs | Use photos, logos you do not have rights to, mascots or team colors |
| Use flat surfaces with 1 px borders | Use gradients, shadows on cards, textures, chalkboards, footballs or whistles |
| Label inferred dates, sources and sample listings | Present derived or demo data as verified fact |
| Use 14 px body and 12 px captions, two weights per block | Use all-caps, letter-spaced labels or more than one display size per screen |
| Write sentence case with real verbs ("joined", "promoted") | Use emoji, exclamation marks or hype |
| Make tap targets at least 40 px on phone and give everything a focus ring | Hide meaning in color alone (the tracker also bolds your conference) |
