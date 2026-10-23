# Integration pass: to do after the screen workflows finish

Collected from audit #1 and its verification. Each item crosses feature boundaries, so it waits until the feature agents release their files.

## Demo honesty
- [ ] Exclude `people.isDemo` (the 8 fictional pipeline candidates) everywhere real people are listed or counted:
  - `src/lib/queries/program.ts`: staff count (~line 41), former-coach count (~42-43), former-coaches list (~105-122), conference peers' staff counts (~183)
  - `src/lib/queries/searchx.ts`: people search; per-program staff and alumni counts (~279-292)
  - `src/lib/queries/profile.ts`: staff count (~46); conference comparison should use the cleaned conference expression (~174)
  - grep every other feature query file for `people` joins without `isDemo` filters
- [ ] Demo messages (seed.ts "// demo messages" block): no fictional AD at a real program announcing a real-sounding search (e.g. Austin College DC search). Use clearly fictional senders: a fictional search firm, a fictional former colleague, or generic product notices, without naming real programs' openings.
- [ ] Jobs posted by the demo AD (source `native`, `isDemo` true) must carry a visible "Demo listing" label wherever jobs render (job cards, job page, feed, program jobs tab). Test artifacts from agents (e.g. job id 29 at Pacific (OR)) are wiped by the next seed.
- [ ] Demo candidates' profiles: show a "Demo candidate" chip and keep them out of search, feed, program pages and "People also viewed".

## Cross-feature wiring
- [ ] `AddToPipelineButton` (components/employer) on profiles and search results for employer sessions.
- [ ] Profile "Claim profile" → `/claim/[slug]`; owner view for the demo coach.
- [ ] Feed "Message" → `/messaging`; job "Apply" confirmation; "Saved jobs" shortcut.
- [ ] Global search "See all results" → `/search?q=`.
- [ ] Every internal link resolves (crawl the app and assert no 404s or error overlays).

## Data display
- [ ] Use `seasonRangeMulti(g.roles)` for experience group ranges (gaps shown, no implied continuous tenure).
- [ ] Tree: show all periods per relationship (`TreeLink.periods`) in the profile preview and tree explorer.
- [ ] Non-football stints (`tenures.sport`): show the sport on the role line ("Assistant basketball coach") and keep them out of football counts.
