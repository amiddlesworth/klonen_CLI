# Product spec: Coach Network MVP

Working name: **Coach Network** (placeholder; the name lives in one constant, `BRAND.name` in `web/src/lib/brand.ts`).

A professional network and hiring layer for US college and pro coaches, launching with NCAA Division III football. Think LinkedIn's information architecture, rebuilt around how coaching careers actually work: season-by-season stints at programs, coaching trees, and a short, intense hiring carousel.

The bar for UI quality is LinkedIn's: calm, dense but never cluttered, obvious hierarchy, nothing decorative that does not carry information. See `docs/DESIGN.md` for the design system; this file says *what* to build.

## Users

| Persona | Primary jobs |
| --- | --- |
| Assistant / position coach | Keep a credible career record, get seen for the next job, search quietly |
| Head coach | Build a staff: find and vet assistants, check references through the tree |
| Athletic director / athletics HR | Post jobs, search candidates, track a hiring pipeline |
| Visitor (signed out) | Look up a coach or program from a search engine; the public profile is the growth loop |

## Core objects

- **Person**: a coach. Built from public sources before launch ("unclaimed"); a coach can claim and correct it.
- **Organization**: a program (college team) or other employer (high school, pro team). Programs in the registry have rich pages; other orgs are lightweight.
- **Tenure (stint)**: person × organization × role × first season–last season. Playing stints are flagged `as_player`. Every seeded stint keeps its source URL and evidence quote.
- **Tree edge** (derived): "worked under" when an assistant's stint overlaps the head coach's stint at the same org; "worked alongside" for two assistants overlapping.
- **Job**: an opening at an organization.
- **Move** (derived feed item): a stint that started in the latest season = a hire; ended = a departure; same org, new role = a promotion.

## Screens, by priority

P0 must ship tonight; P1 should; P2 if time allows. Every screen works at 390 px (phone) and 1440 px (desktop).

### P0
1. **App shell**: top bar with wordmark, global search (people + programs, typeahead), primary nav (Home, Network, Jobs, Messaging, Notifications, Me), "For employers" entry. Phone: compact top bar + bottom tab bar.
2. **Home feed** (signed in): left rail mini-profile card (avatar, name, current role, profile views, "Open to opportunities" status); center feed of moves ("Jane Doe joined Kean as Defensive Coordinator"), new jobs, and milestones; right rail "Carousel tracker" (open jobs, recent hires by conference) and "People you may know" (tree-adjacent coaches).
3. **Coach profile** `/in/[slug]`: header card (avatar, name, current title at program, location, conference badge, counts: coaching stops, seasons coached, tree size), actions (Connect, Message, More). Unclaimed banner: "This profile was built from public sources" + source links + "Is this you? Claim it". Sections: About, Experience (grouped by organization, role progression inside each group, like LinkedIn's grouped positions, season ranges like "2019–2022 · 4 seasons"), Playing career, Coaching tree (worked under / worked alongside / coached under them), Education. Right rail: "Same tree" and "People also viewed".
4. **Program page** `/programs/[slug]`: header (name, nickname, division, conference, city/state, athletics site link), tabs: Staff (current, grouped by unit: head coach, offense, defense, special teams, support), Alumni coaches (people who coached here and where they are now), Jobs.
5. **Search** `/search`: people and programs; facets: division, conference, state, role group (head coach, coordinator, position coach, GA/analyst, support), "worked at" program, "worked under" coach. Result cards with current role and one line of tree context.
6. **Coaching tree explorer** `/in/[slug]/tree`: the coach in the middle, mentors above, people who worked under them below, peers alongside; clean node-link diagram, keyboard and touch friendly; each node links to the profile.
7. **Jobs** `/jobs` + `/jobs/[id]`: list with filters (role group, division, state), detail page with org card and "Apply" (stub). Demo jobs are clearly labeled *Sample listing*.
8. **Signed-out landing** `/`: one-line value prop, people/program search box, three proof points with real numbers from the dataset, sample profiles.

### P1
9. **Claim flow** `/claim/[slug]`: confirm identity (school email code, stubbed), review and correct each stint, publish.
10. **Open to opportunities** settings: who can see it (search firms, specific programs, all employers except my current program), roles and regions wanted. Never visible on the public profile.
11. **Post a job** `/employers/jobs/new`: form + preview + stubbed checkout.
12. **Hiring pipeline** `/employers/pipeline`: shortlists (columns: Sourced, Contacted, Interview, Offer), candidate cards, notes.

### P2
13. **Messaging** `/messaging`: inbox + thread (demo data).
14. **Notifications** `/notifications`.

## Auth (stubbed)

No real auth tonight. A **demo account switcher** in the Me menu lets a viewer act as (a) a seeded coach, Justin Leatherman · Pacific (OR), whose public record stays Unclaimed (the coach session gets an owner view of the profile labeled Demo; see `docs/ARCHITECTURE.md` "Demo accounts"), (b) an athletic director at a seeded program, or (c) signed out. Store the choice in a cookie. Keep the auth boundary in one module (`web/src/lib/session.ts`) so real auth can replace it.

## Data

- Seed data lives in `data/*.json` (committed), produced by `pipeline/`. Programs: 244 NCAA D-III football programs from the NCAA directory; people and stints: extracted from public coach bios.
- Postgres 16 via Drizzle ORM. Schema in `web/src/db/schema.ts`; `npm run db:seed` loads `data/`.
- Demo-only records (sample jobs, demo messages, demo accounts) are flagged `is_demo = true` and labeled in the UI.

## Non-goals tonight

Real auth, payments, email; youth and high-school coaches as first-class users; athlete recruiting; video; ads; native apps.
