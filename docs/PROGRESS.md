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
