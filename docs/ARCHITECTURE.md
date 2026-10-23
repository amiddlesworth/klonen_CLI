# Architecture and conventions

Read with `docs/PRODUCT_SPEC.md` (what to build) and `docs/DESIGN.md` (how it looks).

## Layout

```
data/        committed seed dataset produced by pipeline/ (organizations, people, tenures, tree_edges, stats)
pipeline/    crawl -> bundle -> extract (agents) -> validate -> resolve
web/         Next.js 15 App Router app (TypeScript, Tailwind v4, Drizzle, Postgres 16)
tools/       screenshot.mjs (Playwright) used by agents and audits
docs/        spec, design system, this file, progress log
design/      design proposals and the reference mockups (design/reference/*.html)
```

## Running locally

```
cd web
cp .env.example .env.local        # DATABASE_URL=postgres://coach:coach@localhost:5432/coachnet
npm install
npm run db:reset                  # push schema + seed from ../data
npm run dev                       # http://localhost:3000
```

Screenshot any page: `node tools/screenshot.mjs http://localhost:3000/in/<slug> out.png 1440 900 1` (use width 390, height 844 for phone).

## App conventions

- **Server components by default.** Data comes from `web/src/lib/queries/*` (server-only). Add a client component (`"use client"`) only for real interactivity (typeahead, menus, tabs that must not reload, forms with live state).
- **Never query the database from a component directly**; add or extend a function in `lib/queries`. Keep queries typed and small.
- **Mutations** are server actions in `web/src/lib/actions/*` and must call `getSession()` to check the demo role.
- **Routes**
  - `/` landing (signed out) · `/feed` home feed (signed in)
  - `/in/[slug]` coach profile · `/in/[slug]/tree` coaching tree explorer
  - `/programs/[slug]` program page (`?tab=staff|alumni|jobs`)
  - `/search` (`?q=&type=people|programs&division=&conference=&state=&role=&workedAt=&workedUnder=&page=`)
  - `/jobs`, `/jobs/[id]`
  - `/claim/[slug]`, `/settings/availability`
  - `/employers/jobs/new`, `/employers/pipeline`
  - `/messaging`, `/notifications`
  - `/api/typeahead?q=` JSON for the global search box
- **Components**
  - `web/src/components/ui/*`: design-system primitives (Button, Card, Avatar, OrgMark, Badge, Tabs, Input, SearchField, Skeleton, EmptyState, Menu). Shared by everyone; change only through the foundation owner.
  - `web/src/components/shell/*`: TopNav, BottomTabBar, AppShell, RightRail, DemoSwitcher, GlobalSearch.
  - `web/src/components/<feature>/*`: feature components (profile, tree, program, search, feed, jobs, claim, employer, messaging). A feature agent owns its folder and its routes only.
- **Formatting**: always use `lib/format.ts` (`seasonRange`, `initials`, `hueFor`, `levelShort`, `salaryRange`, `timeAgo`). Season ranges render with tabular numerals and an en dash.
- **Brand**: never hard-code the product name; import `BRAND` from `lib/brand.ts`.
- **Demo data honesty**: anything with `isDemo` or `source === "sample"` shows a small "Demo" / "Sample listing" label. Seeded (unclaimed) profiles show the "built from public sources" banner with source links. Never generate biographical prose about real people; show only structured, sourced facts.
- **Accessibility**: semantic landmarks, one `h1` per page, labelled controls, visible focus, 44px touch targets on phone, color is never the only signal.
- **Performance**: no client-side data fetching for page content; paginate lists over 50 rows.

## Verification every agent runs before finishing

1. `cd web && npx tsc --noEmit` (zero errors) and `npx eslint <your files>` (zero errors).
2. Screenshot each of your routes at 1440 and 390 against the running dev server (`http://localhost:3000`), look at the images, and fix anything that breaks the UI quality bar in `docs/DESIGN.md`.
3. Do not run `next build` while the shared dev server is running (it shares `.next`); the orchestrator runs builds.
