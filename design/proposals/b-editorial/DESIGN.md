# Coach Network design system: Direction B, "Editorial clarity"

This uses LinkedIn's information architecture, set like a good sports page. Type, rules and tabular numbers carry the hierarchy, so the UI needs very few boxes. The product name is a placeholder that lives in one constant (`BRAND.name`, in `web/src/lib/brand.ts`). In the mockups it is the `BRAND` object in the inline script at the bottom of each page.

Files in this folder:

| File | What it is |
| --- | --- |
| `profile.html` | Coach profile (Ian Falconer, Pacific (OR)), unclaimed state, desktop and phone |
| `feed.html` | Signed-in home feed (viewer: Justin Leatherman, Pacific (OR)), desktop and phone |
| `profile-1440.png`, `profile-390.png`, `feed-1440.png`, `feed-390.png` | Full-page captures |
| `profile-390-fold.png`, `feed-390-fold.png` | The first phone screen only. In a full-page capture, the fixed bottom tab bar is drawn at the first fold, over the content. These two files show it as it looks on a device. |

All people, programs and stints shown come from the extracted public bios in the pilot dataset. Job postings are demo data and carry a **Sample listing** label.

---

## 1. Principles

1. **Type carries the hierarchy.** Two families with distinct jobs. The serif is used only for the subject of a page or region: the wordmark, person names in headers, section titles and headline numbers. Everything you read or operate is in the sans. Size, weight and color then build the hierarchy before any box does.
2. **Rules, not boxes.** Hairlines separate content. A 1px ink rule opens a data block, the way a box score's header does. A full border is kept for an object you act on as a unit: a job card, the source banner, the Open-to-opportunities control, inputs. Columns are divided by vertical hairlines, not by stacks of cards on a gray canvas.
3. **Numbers set like a box score.** Seasons, counts and records use tabular lining figures in right-aligned columns, and season ranges always use the same format. A coach's whole career should be readable down one column.
4. **One accent, only for action.** Ink blue marks the primary button, links and focus. It never decorates, never encodes data and never marks status. Most screens have one or two blue elements.
5. **Show the source, never guess.** Data derived from public sources says so. Missing facts are written as "not in source", never filled in. Demo content is labeled. A recruiter or athletic director has to be able to trust every line.

---

## 2. Color tokens

The page background is white in light mode, with no gray canvas. Grays are very slightly warm so the page reads as paper rather than as an app chrome.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#FFFFFF` | `#101113` | Page, surfaces |
| `--bg-subtle` | `#F7F7F5` | `#17181B` | Source banner, logo tiles, hover on secondary buttons |
| `--bg-muted` | `#EFEFEB` | `#202125` | Search field fill, quiet-button hover |
| `--line` | `#E5E5E0` | `#2B2D32` | Hairlines, column rules, card borders |
| `--line-strong` | `#CFCFC8` | `#3C3E44` | Season-strip brackets, chip borders, role connectors |
| `--control` | `#87898F` | `#7A7C82` | Outlined button and input boundaries (≥3:1 for non-text UI) |
| `--text` | `#16171A` | `#ECECE8` | Primary text, ink rules, active nav indicator, head-coach cells |
| `--text-2` | `#45474D` | `#B5B7BC` | Secondary text, role history, quiet buttons |
| `--text-3` | `#66686E` | `#8F9197` | Meta, kickers, captions, years in lists |
| `--accent` | `#1F4FC9` | `#8DA9FF` | Primary button, links, focus ring |
| `--accent-hover` | `#183EA0` | `#ABC0FF` | Hover/pressed for accent |
| `--accent-subtle` | `#EEF2FC` | `#1A2442` | Selected rows in menus only |
| `--on-accent` | `#FFFFFF` | `#0B1533` | Text on accent |
| `--positive` | `#1D7A4F` | `#5CC793` | "Matches your role" check, Open-to-opportunities **On** dot |
| `--lvl-1` / `--lvl-2` | `#16171A` / `#8E9097` | `#ECECE8` / `#7A7C82` | Season strip: head coach / coordinator. Position-coach seasons are outlined in `--lvl-2`. |

Avatar tints are six muted pairs. Assign them by a stable hash of the person's id so a person keeps one color everywhere.

| Tint | Light bg / fg | Dark bg / fg | Contrast L / D |
| --- | --- | --- | --- |
| 1 slate | `#E3E8EF` / `#2C3A4F` | `#26303D` / `#C9D5E6` | 9.34 / 8.99 |
| 2 sage | `#E1EBE4` / `#26402F` | `#25332A` / `#C4DCCB` | 9.27 / 9.11 |
| 3 sand | `#EFE8DC` / `#4A3B22` | `#3A3226` / `#E3D4BA` | 8.89 / 8.65 |
| 4 clay | `#F0E2DD` / `#4F2C22` | `#3C2B26` / `#E8CBC0` | 9.69 / 8.77 |
| 5 lilac | `#E7E4F0` / `#352E4F` | `#2F2B3D` / `#D4CDEA` | 10.12 / 8.95 |
| 6 steel | `#DDE9EE` / `#213F4C` | `#22343B` / `#C0DAE4` | 9.02 / 8.87 |

### Contrast (WCAG 2.2)

Every text pair meets AA (4.5:1 for body text). Most meet AAA (7:1).

| Pair | Light | Dark | Result |
| --- | --- | --- | --- |
| `--text` on `--bg` | 17.92 | 15.95 | AAA |
| `--text` on `--bg-subtle` | 16.71 | 14.99 | AAA |
| `--text-2` on `--bg` | 9.29 | 9.41 | AAA |
| `--text-2` on `--bg-subtle` | 8.66 | 8.85 | AAA |
| `--text-3` on `--bg` | 5.57 | 6.00 | AA |
| `--text-3` on `--bg-subtle` | 5.19 | 5.63 | AA |
| `--text-3` on `--bg-muted` (search placeholder) | 4.83 | 5.10 | AA |
| `--accent` on `--bg` (links) | 6.95 | 8.32 | AA (light), AAA (dark) |
| `--accent` on `--bg-subtle` (banner link) | 6.48 | 7.82 | AA / AAA |
| `--accent` on `--accent-subtle` | 6.21 | 6.73 | AA |
| `--on-accent` on `--accent` (primary button) | 6.95 | 7.91 | AA / AAA |
| `--on-accent` on `--accent-hover` | 9.39 | 10.02 | AAA |
| `--positive` on `--bg` | 5.32 | 9.04 | AA / AAA |
| `--bg` on `--text` (notification count) | 17.92 | 15.95 | AAA |
| `--control` on `--bg` (button and input outline) | 3.50 | 4.53 | Meets 3:1 for non-text UI |
| `--lvl-2` on `--bg` (strip cells, outlines) | 3.19 | 4.53 | Meets 3:1 for graphics |

`--line` (1.26:1) and `--line-strong` (1.57:1) are decorative separators only. Never use them as the only boundary of a control. The search field is the one control drawn by fill alone. Its icon and placeholder identify it, and on focus it gets a 2px accent ring and a white fill.

---

## 3. Typography

**Families** (Google Fonts):

- UI and reading: **Inter** 400, 500 and 600. Fallback: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- Display: **Source Serif 4** 600, with optical sizing on. Fallback: `Georgia, "Times New Roman", serif`.

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap
```

**Numerals:** any number that sits in a column or could be compared (seasons, ranges, counts, records, view counts) gets `.num`, which sets `font-variant-numeric: tabular-nums lining-nums`. Serif headline numbers use lining tabular figures as well.

| Token | Family | Size / line | Weight | Tracking | Use |
| --- | --- | --- | --- | --- | --- |
| `display` | Serif | 34/40 (phone 28/34) | 600 | -1.2% | Profile name |
| `h2` | Serif | 22/28 (phone 20/26) | 600 | -0.6% | Section titles (About, Experience) |
| `stat` | Serif | 28/32 (rail 24/28, feed 26/30) | 600 | 0 | Headline numbers in stat bands |
| `name-m` | Serif | 20/26 | 600 | -0.8% | Mini-profile name, digest title (19/24) |
| `wordmark` | Serif | 21/21 | 600 | -1.5% | Top nav |
| `headline` | Sans | 17/24 (phone 16/22) | 400 | 0 | Profile headline (current title at program) |
| `h3` | Sans | 16/22 | 600 | -0.6% | Organization names, job titles |
| `lede` | Sans | 15/22, About 15/24 | 400, names 600 | 0 | Feed headlines, About |
| `body` | Sans | 14/20 | 400 / 500 | 0 | Default text, role titles (500), buttons (600) |
| `meta` | Sans | 13/18 | 400 | 0 | Org meta, context lines, years |
| `caption` | Sans | 12/16 | 400 | 0 | Provenance notes, footers, compact years |
| `kicker` | Sans | 11/16 | 600 | +7%, uppercase | Column heads, item type ("Hire / USA South"), stat labels |
| `nav` | Sans | 12/16; tab bar 11/14 | 400; tab 500 | 0 | Top-nav labels, bottom tabs |

Measure: running text (About, posts) is capped at 64ch.

### Season and title formats

| Context | Format | Example |
| --- | --- | --- |
| Full range | `YYYY–YYYY`, en dash, no spaces | `2010–2019` |
| Current | `YYYY–Present` | `2020–Present` |
| Single season | `YYYY` | `2003` |
| Non-contiguous stints at one program | comma list | `2003, 2006–2009` |
| Count | inclusive of both ends | `10 seasons`, `1 season` |
| Compact (tree lists, rails, feed records) | two-digit end, open end | `2010–19`, `2020–` |
| Unknown years | say so | `Four seasons; years not in source` |

Titles are shown as each program publishes them (Title Case) in labels and on cards. Feed sentences use AP style, with titles in lowercase after the name: "Jarren Horton joined Brevard College as associate head coach for defense and defensive coordinator."

---

## 4. Spacing

The base unit is 4px. Use only these steps: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64**.

| Step | Typical use |
| --- | --- |
| 4 / 8 | Icon-to-label, inside chips, between a title and its meta line |
| 12 / 16 | Between related lines in a block, avatar-to-text (12 in lists, 14–16 in headers), button padding |
| 20 / 24 | Between blocks in a section, banner padding, phone vertical rhythm |
| 32 | Between sections (32 top padding after a hairline), desktop column padding |
| 40 / 48 | Main-to-rail gutter (40), page bottom padding |
| 64 | Reserved for empty states and the signed-out landing |

The rhythm rule: a hairline always has equal space above and below it within a component, except the ink rule that opens a table, which sits tight (8px) under its column heads.

## 5. Radii

| Token | Value | Use |
| --- | --- | --- |
| `--r-xs` | 2px | Season-strip cells, bars |
| `--r-sm` | 4px | Chips, badges |
| `--r-md` | 6px | Buttons, search field, inputs, organization logo tiles |
| `--r-lg` | 8px | Bordered objects: source banner, job card, Open-to-opportunities box, phone tracker strip |
| round | 50% | Person avatars only |

Shape carries meaning: **people are circles, organizations are rounded squares.**

## 6. Elevation and borders

- At rest, nothing has a shadow.
- **Hairline:** `1px solid var(--line)`. Divides rows, list items, sections, and the vertical column rules between the main column and the rails.
- **Ink rule:** `1px solid var(--text)`. Opens a data block: the profile stat band, the Experience column heads, the coaching-tree columns, the mini-profile stats, the tracker stats and the milestone figures. Use one per block, never stacked.
- **Bracket:** `1px solid var(--line-strong)` under season-strip org labels.
- **Control outline:** `inset 0 0 0 1px var(--control)` on secondary buttons and form inputs.
- **Popover** (typeahead, Me menu, More menu): `0 1px 2px rgba(22,23,26,.06), 0 8px 24px rgba(22,23,26,.10)`, radius 8, with a 1px `--line` border in dark mode. This is the only shadow in the system.

---

## 7. Layout grid

**Desktop (≥1101px).** The shell's content width is **1160px**, centered with 24px side padding (max 1208). The top nav is 56px and sticky.

| Screen | Columns | Notes |
| --- | --- | --- |
| Home feed | **236** \| **1fr** (620) \| **300** | Left rail has a 28px right padding and a rule. The center has 32px padding on each side, which leaves 556px of reading width. The right rail has a rule and 28px left padding. |
| Profile | **1fr** (860) \| **300** | Main has 40px right padding, leaving 820px of content, then a rule. The rail has 32px left padding. |
| Program, Search, Jobs | Same as the profile (main + 300 rail) | Search facets go in a 236 left rail, like the feed |

**Tablet (761–1100px).** The feed drops its left rail. The mini-profile moves into the Me menu, and the feed becomes `1fr | 300`. On the profile, the rail moves below the main column as a two-up grid.

**Phone (≤760px).**

- 16px side gutters, single column.
- **Top bar**, 52px and sticky: viewer avatar (opens Me) · search field (flex) · Messaging icon with unread pip. There is no wordmark. "For employers" lives in the Me menu.
- **Bottom tab bar**, 56px plus the safe-area inset, fixed: Home · Network · Jobs · Alerts · Me. The body gets 72px of bottom padding.
- Rails stack below the main content (profile). On the feed, the right rail collapses into a one-line **Carousel tracker strip** above the first item.
- In feed items, the avatar sits beside the headline only. Records, groups, figures and actions run the full width, aligned to the gutter.

---

## 8. Components

### Top nav (desktop)
- 56px tall, white background, bottom hairline, sticky.
- Left: serif wordmark, then a 20px gap, then the search field (288 × 36).
- Right: nav items 76px wide minimum, each a 20px Lucide icon over a 12/16 label in `--text-3`. Items: Home, Network, Jobs, Messaging, Notifications, Me (22px avatar with a chevron). After a vertical hairline: For employers (grid icon with a chevron).
- **Active item:** `--text` color plus a 2px ink bar flush with the bottom hairline. Not accent.
- **Counts:** 16px ink pill with white 10px numerals, offset to the top right of the icon.

### Bottom tab bar (phone)
- Five equal cells: 22px icon over an 11/14 label at weight 500, `--text-3`.
- **Active:** `--text` color plus a 2px ink bar on the top edge, about 44% of the cell wide.
- No labels are hidden and no icon gets a filled variant. The active state comes from color and the indicator only.

### Card and rail module
- A "card" in this system is a **module**: a heading (15/20 sans 600) or a kicker, then its content, closed by a hairline with 24px of space above and below. The last module has no rule.
- A full border appears only on an actionable object. When that is needed, the object gets an 8px radius, 1px `--line` and 16px padding.

### Profile header
- Grid of a 96px avatar plus the identity block, with a 24px gap and vertical centering.
  - Name: `display`, serif.
  - Headline: current title and program, 17/24.
  - Meta line, 13/18 `--text-3`: map-pin and city, then division, then a conference chip.
- **Stat band:** ink rule on top, hairline below. Three cells (Coaching stops · Seasons coached · Coaching tree), each a kicker label over a serif `stat` number, divided by hairlines with 28px padding.
- **Actions** sit right-aligned in the same band: Connect (primary, user-plus), Message (secondary, send), More (36px icon button).
- **Phone:**
  - 72px avatar, name at 28/34, and stats that fill the width with short labels (Stops, Seasons, Tree).
  - Actions move to their own row, with Connect and Message flexed to equal width.

### Source banner (unclaimed profile)
- Sits directly below the header.
- `--bg-subtle` fill, 1px `--line` border, radius 8, padding 14/16, and an info icon. Contents:
  - Title "This profile was built from public sources" (14/20 600).
  - One line of explanation (13/18 `--text-2`).
  - The source links (accent, with an external-link icon) and "Checked {Mon YYYY}".
- Right side: "Is this you?" over a secondary **Claim this profile** button.
- The accent is used only for the links, so the banner does not shout.
- **Phone:** the claim row moves under the text, with the label on the left and the button on the right.

### Experience: grouped by organization (the "box score")
- **Column heads** (kickers): "Program and role", then "Seasons" and "Yrs" right-aligned. An ink rule sits underneath.
- **Grid** for every row: `1fr | 128px | 44px`, with a 12px gap.
- **Org row:**
  - A 40px logo tile, then the org name (`h3`, a link) and a meta line (division · conference · city).
  - Right columns: the full range and the total count, both at 14/22 weight 600 in `--text`.
- **Role rows** are indented 56px so they align with the org name:
  - Title: 14/20 weight 500.
  - Optional note: 13/18 `--text-3`. Notes are derived from the source, for example "Returned after two seasons at Oberlin."
  - Range and count: `--text-2` and `--text-3`, weight 400.
- **Progression:**
  - A 1px `--line-strong` connector runs at the logo's center line, with a 7px node on each role.
  - The current role's node is solid ink. Past roles are hollow.
  - Roles are listed newest first.
- If an org has a **single role**, only the org row shows the numbers, so they are never printed twice.
- Groups are separated by hairlines.
- **Phone:**
  - The numeric columns collapse.
  - Each role shows `2020–Present · 7 seasons` under its title.
  - The org total moves into the meta line as `· 17 seasons`.

### Season strip
- One cell per season, from the first coaching season to the current one, in a 25-column style grid with a 3px gap, 16px tall and radius 2.
- Encoding: head coach is solid `--lvl-1`, coordinator or assistant head coach is solid `--lvl-2`, position coach is outlined in `--lvl-2`.
- **Desktop:** org labels sit above each span (11/14, weight 500) with a bracket rule under them.
- **Axis:** year ticks below at the first season, each move to a new program and the current season.
- A legend sits in the section head. On phone the org labels are hidden and the legend moves under the strip.
- Each cell has a tooltip: "2006 · Lewis & Clark · Offensive coordinator".
- The strip is supplementary. The table below it carries the same facts for screen readers.

### Tree mini-list
- An ink rule on top, then two columns:
  - Left, stacked: "Worked under" and "Worked alongside".
  - Right, wider, with a two-up list: "Coached under him/her".
- Each group has a kicker label with its count right-aligned in ink.
- **Person row:**
  - 32px avatar, then the name (14/20 600) and a one-line role (12/16 `--text-3`, ellipsized).
  - The overlap years are right-aligned in compact format (`2010–19`, `2025–`).
- Footer: "Show all N" (link) and a one-line caption explaining how edges are derived.
- **Phone:** a single column with hairlines between groups.

### Feed item
- Items are separated by hairlines, with padding of 20 above and 14 below. Anatomy:
  1. **Kicker row:** type and conference ("Hire / USA South", "Promotion / …", "Milestone / …", "Job / …", "Transactions / …") on the left. On the right, the season ("2026 season") or a **Sample listing** chip. Moves are dated by season, never by a fake timestamp.
  2. **Grid** of a 48px avatar (or a logo tile for a program) and the body, with a 14px gap.
  3. **Headline:** one sentence at 15/22, with the person and program in weight 600 as links.
  4. **Payload**, one of:
     - **Transaction record:** 2–3 rows of `year | node | role · org`. The newest row is ink weight 500 with a solid node; earlier rows are `--text-2`. A connector joins the nodes. Year column: 64px desktop, 60px phone.
     - **Grouped move:** a hairline list of 40px person rows with the new title and where they came from.
     - **Milestone figures:** an ink-ruled stat band of three serif numbers.
     - **Digest (agate):** program name in small caps 600, conference in 12px `--text-3`, then one sentence in AP style. Rows are separated by hairlines.
  5. **Context line:** 13/18 `--text-3`, for the tree or shared-history reason this item is shown ("Portland State alum, like you").
  6. **Actions:** quiet buttons (Congratulate, Comment, Share), 32px tall, with 16px icons in `--text-3`. The row is offset -10px so the text lines up with the column.

### Job card
- Bordered object: radius 8, 16px padding. Grid of a 48px logo tile, the details, and actions.
- Details: title (16/22 600, a link), org (14/20), meta (city · type · start season), and an optional fit line (positive check plus "Matches your position group").
- Actions: secondary small **View job** and a 30px bookmark icon button.
- Demo jobs always show the dashed **Sample listing** chip.
- **Phone:** the actions go full width under the details.

### Buttons
| Variant | Spec |
| --- | --- |
| Primary | 36px, 16px padding, radius 6, `--accent` fill, `--on-accent` 14/20 600. At most one per view region. |
| Secondary | Same size, `--bg` fill, inset 1px `--control`, `--text`. Hover: `--bg-subtle` with an inset `--text-2` outline. |
| Quiet | 32px, 10px padding, no outline, `--text-2` 13px 500. Hover: `--bg-muted`. |
| Small | 30px, 12px padding, 13px. |
| Icon | Square (36 or 30), same border as secondary, with an `aria-label`. |

- Focus on every variant: a 2px `--accent` outline with a 2px offset.
- Disabled: 40% opacity and no hover state.
- Pill-shaped buttons are not used.

### Chips and badges
- **Chip:** 22px tall, 8px padding, radius 4, 1px `--line-strong` border, 12px 500 `--text-2`. Used for the conference and for filters.
- **Sample chip:** dashed `--control` border. Used only for demo content.
- **Count badge:** ink pill (nav only).
- Status chips are never colored. Status is text, optionally with a small dot (Open to opportunities: hollow dot for Off, `--positive` dot for On).

### Search field
- 36px tall, radius 6, `--bg-muted` fill, a 16px search icon in `--text-3`, and the placeholder "Search coaches and programs".
- **Focus:** white fill and a 2px accent ring.
- **Typeahead popover** (shadow-pop, radius 8) has two groups with kicker labels, "People" and "Programs":
  - People rows: 32px avatar with name and current role.
  - Program rows: logo tile with name and conference.
  - The last row reads "See all results for '…'".
- Desktop width is 288px. On phone it flexes.

### Tabs
- Text tabs, 14/20 500 `--text-3`, with a 24px gap (20 on phone) and a bottom hairline on the container.
- **Active:** `--text` 600 with a 2px ink bar over the hairline.
- On phone, tabs scroll horizontally and never wrap.
- A filter control (quiet button with a chevron) may sit at the right end.

### Avatars and logo tiles
- Person avatars use initials (first and last) on a tint, weight 600, at these sizes:

  | Size | 24 | 32 | 40 | 48 | 64 | 96 |
  | --- | --- | --- | --- | --- | --- | --- |
  | Initials | 10 | 12 | 14 | 16 | 21 | 32 |

- No photos in the MVP.
- Org tiles are rounded squares on `--bg-subtle` with a 1px `--line` border and 2–3 letter initials in `--text-2`.

### Empty states
- Centered in the column, with 64px of space above.
- A 20px Lucide icon in `--text-3`, then a one-line title (15/22 600) and one sentence of explanation (13/18 `--text-2`), then at most one secondary button.
- No illustrations.
- Examples:
  - Tree: "No coaching tree yet. Trees appear when two coaches share seasons on a staff."
  - Jobs filter: "No openings match these filters." [Clear filters]

---

## 9. Iconography

- Use **Lucide** (ISC license) at stroke 1.75, round caps and joins, on a 24px grid. Draw icons with `currentColor`, inline as an SVG sprite (`<symbol>` plus `<use>`).
- Sizes: 14 (inline with meta), 16 (buttons, links), 20 (top nav), 22 (tab bar).
- Default color is `--text-3`. Icons inside buttons inherit the button color.
- Icons are always outline. Active states change color, never the fill.
- Icons used here: `search`, `house`, `users`, `briefcase`, `message-square`, `bell`, `layout-grid`, `chevron-down`, `chevron-right`, `user-plus`, `send`, `ellipsis`, `info`, `external-link`, `map-pin`, `network`, `bookmark`, `thumbs-up`, `share`, `eye-off`, `check`.
- Never use sport pictograms (balls, whistles, goalposts, clipboards).

## 10. Motion

- Color and background transitions run 120ms with an `ease` curve. That is all that moves at rest.
- Popovers and menus fade and rise 4px over 160ms (`cubic-bezier(.2,.8,.2,1)`), and close in 100ms.
- Tab and nav indicators do not slide. They change state.
- Loading uses static `--bg-muted` blocks in the final layout's shape. No shimmer, no spinners in lists.
- `prefers-reduced-motion: reduce` removes all transforms and keeps only opacity.

---

## 11. Do and don't

**Do**
- Let the serif mark the subject of a page or region and nothing else.
- Put every comparable number in `.num` and right-align numeric columns.
- Use one ink rule to open a data block, and hairlines inside it.
- Keep blue for the next action: Connect, Claim, Apply, links.
- Write moves as AP-style sentences and date them by season.
- Say "not in source" when a fact is unknown. Label demo data "Sample listing".
- Show why something is in the feed (tree or shared history) in one muted line.
- Keep people as circles and programs as squares.

**Don't**
- Don't wrap every section in a bordered, shadowed card on a gray canvas.
- Don't use gradients, cover banners, background textures or photos of fields.
- Don't use emoji, sport clip-art, chalkboards, whistles or footballs.
- Don't use a second accent, colored status pills or colored charts. The strip and bars are grayscale.
- Don't use relative timestamps ("2h ago") for derived moves, and don't invent dates or roles.
- Don't center-align body text or mix serif into buttons, labels or tables.
- Don't truncate a person's name. Truncate their role line instead.
- Don't use more than one primary button in a region.
