# Overnight build log

Started 2026-10-23 05:07 UTC. Branch: `coach-network-mvp`.

## Data pilot (15 random D-III football programs, seed 2026)
- Staff pages: 14/15 parsed (all SIDEARM); Worcester State blocks automated access (CloudFront 403).
- 156 coach bios fetched; 31% have no career history at all, 26% thin, 44% full.
- Extraction: 629 stints; 58% of coaches have at least one prior coaching stop; 70% of coaching stints have a start year.
- Precision: hand audit of 25 random stints: 24 correct, 1 unverifiable role (96%). Evidence quotes match source text verbatim for 94% of stints.
- Fix for the full run: exclude student managers.

## Full D-III crawl
- Registry: 244 D-III football programs from the NCAA directory (academic year 2026-27).
- Staff pass 1: 182/244 programs parsed. Pass 2 (follow redirects to the real athletics domain, homepage link discovery, wider bio-link patterns): **196/244 programs (80%)**.
- Not covered (48): 27 sites answer 403 to automated requests (left alone on purpose), 1 disallows us in robots.txt, 13 unreachable from this network (TLS/connection errors), 7 layouts not parsed.
- Bios: 2,297 fetched (2,296 OK). Bug found and fixed: SIDEARM wraps pages in an ASP.NET <form>, which the first text extractor stripped; reparsed from cache, no refetch.
- Extraction: 59 agents over 196 per-program bundles, every file passes the validator (schema + every evidence quote found verbatim in the source bio).
- Resolution: 2,178 coaches (118 non-coaching staff excluded), 8,397 stints (6,822 coaching), 65% of coaching stints have a start year; 2,097 organizations (6,260 stint orgs matched exactly to the NCAA directory, 59 fuzzy, 2,078 to non-NCAA orgs such as high schools, NAIA, JUCO, pro teams).
- Coverage: 1,255 coaches (58%) have at least one prior coaching stop; bios: 51% full, 17% thin, 32% empty.
- Coaching tree: 1,393 "worked under" and 4,633 "worked alongside" edges from overlapping seasons.
- Org matching fixes: NCAA names carry state suffixes ("Central College (Iowa)") and formal forms ("State University of New York at Cortland"); added alias rules, level-aware disambiguation (Trinity CT vs TX), and a small manual alias map.

## Audit #1 (08:10 UTC)
- Build health: `tsc` 0 errors, `eslint` 0 errors (1 unused import fixed), vitest 21/21, pipeline tests 13/13, `next build` passes (built in a copy so the shared dev server is untouched).
- Data spot-check, 25 random stints from the full run, two independent verifiers: 18-20 correct, 3-5 partly correct, 2 unverifiable (empty bios), **0 wrong, 0 wrong-school matches**. Partly-correct cases: years derived from durations flagged as explicit; one basketball stint recorded as football.
- Adversarial review + dataset sweep: 42 findings raised, **30 confirmed** by a skeptic pass, 12 rejected. Biggest: unguarded fuzzy org matches merging different schools; undated current stints producing no tree edges; bare position titles classed "other"; head-coach detection catching JV/interim roles; non-football stints in the football data; one duplicated person; titles read from the wrong table column at two programs; feed/alumni queries choosing the wrong stint; seeded hiring pipeline and sample jobs implying things about real coaches.
- Decision: a real coach can be the demo "view as" persona, but we never mark a real person's profile as claimed; public profile stays Unclaimed.
- Fixes (two rounds, each independently verified):
  - Org matching: no unguarded fuzzy matches; level-aware ties; renamed schools merge; state hints for high schools. Exact NCAA matches 6,260 -> 6,361.
  - Tree: undated current staff now count for the 2026 season; one edge row per contiguous overlap; no self edges. "Worked under" 1,393 -> 2,367, "worked alongside" 4,633 -> 11,715; coaches with no tree link 862 -> 2.
  - Roles: bare position titles -> position coach; head coach only for varsity football HC. 195/196 programs have exactly one current head coach (Plymouth State lists co-head coaches).
  - Honesty: 572 derived years now flagged inferred; invented end years removed (9 -> 0); non-football stints tagged (330) and kept out of football counts and edges; "seasons coached" counts distinct covered seasons (e.g. 43 -> 5 for one coach whose sources cover 5).
  - Demo data: fictional candidates in the hiring pipeline; sample jobs only at programs with no staff on the network; demo search renamed.
  - New `pipeline/check_dataset.py` asserts the invariants on every run; 17 pipeline test groups, 63 web tests.
  - Fresh 25-stint spot-check after fixes: 21 correct, 3 unverifiable (empty bios), 1 partly correct, 0 wrong.

## Audit #2 (11:17 UTC)
- Build health green: tsc, eslint, 63 tests, dataset invariants, production build of all 20 routes.
- Panels: cross-screen consistency (25 findings, 11 major), mobile/accessibility (15, 5 major), security (12, incl. critical GHSA-9qr9-h5gf-34mp in next 15.5.4 / react 19.1.0), fresh spot-check (22/25 correct, 3 minor). The link crawler stalled on the dev server and was stopped; findings were taken from the four finished panels.
- All findings folded into the integration pass (security upgrade to next 15.5.28 / react 19.1.10 and hardening, consistency, demo honesty, cross-feature wiring).

## Audit #3 / morning wrap-up (14:12 UTC)
- All ten screens completed their build -> review -> fix rounds.
- Private demo published: https://claude.ai/artifact/WHdcyt6LcaGe6z51aWZnGf (448 browser-rendered pages + hub).
- Strategy doc Ingestion section updated with final numbers.
- Integration pass with full verification running; see docs/MORNING_REPORT.md.

## Integration pass (finished ~17:30 UTC)
- Security: next 15.5.28 / react 19.1.10 (GHSA-9qr9-h5gf-34mp); demo job posts, messages and pipeline edits scoped to the posting browser with caps; role allowlist and same-origin redirects; Object.hasOwn session check; unique indexes + ON CONFLICT; zod on every action; canonical URLs from SITE_URL; /dev/components 404 in production; CSP, X-Frame-Options, nosniff, Referrer-Policy, no X-Powered-By.
- Consistency: one job detail, one JobCard, one Current program card, one page header pattern, one stepper, signed-out navigation, consistent totals, place formatting, focus rings, phone fixes.
- Final review: build health green; design panel "reads as one system" with 3 majors fixed (search ranking, row actions, inferred-year key); mobile 14/15 earlier findings fixed plus one new overflow fixed; security 9/12 fixed outright plus pipeline scoping. 26 minor items in docs/POLISH_BACKLOG.md.
- Demo refreshed from the integrated production build (version 4 of the private artifact).
