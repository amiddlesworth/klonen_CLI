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
- Staff pass 1: 182/244 programs parsed, 2,115 staff. Failures: 27 sites answer 403 (left alone on purpose), 12 non-standard URLs, 9 unparsed layouts, 13 TLS/connection errors. Pass 2 in progress.
