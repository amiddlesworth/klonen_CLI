# Morning report: Coach Network overnight build

Friday 2026-10-23. Branch `coach-network-mvp` on [amiddlesworth/klonen_CLI](https://github.com/amiddlesworth/klonen_CLI/tree/coach-network-mvp) (main has only a README; nothing merged).

## Where to look

- **Private demo (phone friendly):** https://claude.ai/artifact/WHdcyt6LcaGe6z51aWZnGf. A read-only snapshot of 448 real pages of the app. It is private to you; share it from the page's Share menu.
- **Run the full app locally:** `cd web && cp .env.example .env.local && npm install && npm run db:reset && npm run dev` (needs Postgres 16; see `docs/ARCHITECTURE.md`). Switch between the coach and athletic-director demo accounts from the Me menu.
- **Strategy doc** (product scope, build plan, investment memo): https://claude.ai/artifact/3vu3zWQhU3ape2uQFKZyxR. Its Ingestion section now has the final crawl numbers.

## What was built

1. **Data, with no school involvement.** All 244 NCAA Division III football programs from the NCAA directory; staff pages read for 196; 2,296 coach bios turned into 2,177 coaches, 6,881 coaching stints and 14,082 coaching-tree links (2,367 "worked under", 11,715 "worked alongside"). Every stint keeps the sentence it came from.
2. **The app**, Next.js + Postgres, on a design system chosen by a three-way design competition judged on rendered screenshots:
   - Coach profile (season strip, grouped experience, sourced roles, coaching tree preview), coaching-tree explorer, program pages, faceted search, home feed (hires, promotions, milestones, jobs), jobs with post-a-job, claim-your-profile flow, private "Open to opportunities" settings, an athletic director's hiring pipeline, messaging and notifications.
   - Every screen went through two rounds of review by a product designer and a former-AD domain reviewer at desktop and phone widths.
3. **Three audits and an integration pass**, each with independent verifiers and a skeptic pass before fixes. They found and fixed, among other things: different schools merged by fuzzy name matching, missing tree links for current staff, inflated "seasons coached", non-football jobs counted as football, a critical Next.js/React security advisory (now on Next 15.5.28 / React 19.1.10, with security headers, input validation and per-browser scoping of demo writes), and demo data that implied things about real coaches.
4. **Final state:** typecheck and lint clean, 307 automated tests passing, all dataset invariants holding, production build verified (dev pages return 404, CSP and frame headers present).

## Accuracy and coverage

| Measure | Result |
| --- | --- |
| Hand audits of random stints against source bios (4 x 25) | 0 wrong stints, 0 wrong-school matches; the rest correct, partly correct (a year or role detail) or unverifiable because the bio is empty |
| Coaches with at least one prior coaching stop | 1,257 of 2,177 (58%) |
| Bios with no career history | 32% |
| Programs not covered | 48 of 244: 27 sites block automated access (respected), 13 unreachable, 1 robots.txt, 7 unparsed layouts |

## Decisions I made for you

- **Name:** "Coach Network" is a placeholder in one constant (`web/src/lib/brand.ts`).
- **Real coach as demo viewer, never shown as claimed.** The coach demo account views the app as Justin Leatherman (Pacific (OR)); his public profile stays Unclaimed. We never mark a real person as having claimed a profile.
- **Demo records are fictional and labeled:** the athletic director, the 8 hiring-pipeline candidates, message threads and sample jobs. Sample jobs sit only at programs with no staff data, so no listing implies a real coach is leaving.
- **Respected every site that blocks crawlers** instead of working around it.
- **Conservative career stats:** "seasons coached" counts only seasons the sources cover (one coach dropped from 43 to 5). Derived years show a dotted underline; nothing claims more than the source says.
- **Bio text:** only a short, attributed quote (up to ~280 characters) appears; no generated biography about real people.
- **Next.js + Postgres** instead of a static site, so public profiles are indexable by search engines.

## Known gaps

- The demo is a static snapshot: menus, search box, filters and forms don't run in it. The local app runs all of them.
- Auth, payments and email are stubbed (demo account switcher).
- 26 minor polish items remain from the final design, mobile and security review; they are listed in `docs/POLISH_BACKLOG.md`. None blocks the demo.
- `npm audit` still lists drizzle-orm below 0.45.2 (not exploitable in how we use it), sharp (fixable with `npm audit fix`), postcss inside Next (needs Next 16) and dev-only vitest dependencies.
- Recall: a third of bios carry no history. Second sources (other staffs, all-time assistant lists, media guides) would close much of it.

## What needs your input

1. **Product name** (and a trademark check).
2. **Legal posture before any public launch:** crawling public staff pages and publishing profiles of people who did not opt in (right of publicity, site terms, takedown flow).
3. **Hosting:** if you want a live deploy, add `VERCEL_TOKEN` and a Neon `DATABASE_URL` as environment secrets.
4. **Extraction at scale:** an `ANTHROPIC_API_KEY` secret would let the pipeline run extraction directly (tonight it ran through agents).
5. **Next scope:** D-II and D-I football (about 430 more programs), or other D-III sports.
6. **"Seasons coached" definition:** keep the strict count, or show a range when many stints are undated.
