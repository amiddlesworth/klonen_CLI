export const meta = {
  name: 'build-screens',
  description: 'Build product screens in parallel on the shared UI foundation, each with a screenshot design review and fix loop',
  phases: [
    { title: 'Build', detail: 'one agent per feature, owns its routes and component folder' },
    { title: 'Review', detail: 'designer + domain reviewer judge screenshots; builder fixes' },
  ],
}
const R = '/home/user/klonen_cli'
const CTX = `Repo: ${R} (branch coach-network-mvp). Read ${R}/docs/ARCHITECTURE.md (conventions; follow them exactly), ${R}/docs/PRODUCT_SPEC.md, and ${R}/docs/DESIGN.md (source of truth for visuals; read §2-§7, §8.0-§8.3, §11-§12 and your screen's section). Reference mockups: ${R}/design/reference/profile.html, feed.html and their PNGs. The UI foundation is built: use web/src/components/ui/*, web/src/components/shell/*, web/src/components/data/* (see /dev/components gallery at http://localhost:3000/dev/components). Do NOT edit those shared folders, globals.css, layout.tsx, db/schema.ts, or lib/queries files other agents may use; if you need new queries, create web/src/lib/queries/<your-feature>.ts; new server actions go in web/src/lib/actions/<your-feature>.ts; components go in web/src/components/<your-feature>/. A dev server is ALREADY RUNNING at http://localhost:3000 (never start another; never run next build). COPY RULE: never use gendered pronouns (he/him/his/she/her) for coaches; gender is not in the data. Use the first name ("Coached under Ian", "Ian's tree") or neutral phrasing ("Worked under", "Quoted from the staff bio"). Data is real NCAA Division III football coaches (some fields sparse: many coaches have only their current job; years can be null) plus clearly labeled demo records. Demo login: the Me menu, or set cookie cn_demo_session=coach|employer. Screenshot: node ${R}/tools/screenshot.mjs <url> <out.png> <width> <height> 1 (save under ${R}/design/screens/<feature>/). Signed-in screenshots: prefix with COOKIE='cn_demo_session=coach' (or employer). Dark mode: prefix with THEME=dark.`

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] } }, required: ['where', 'problem', 'fix', 'severity'] } },
  },
  required: ['pass', 'issues'],
}

const features = args.features

const results = await pipeline(
  features,
  (f) => agent(`${CTX}\n\nYOUR FEATURE: ${f.key}\nRoutes you own: ${f.routes}\nBrief:\n${f.brief}\n\nBuild it completely: loading.tsx skeletons, empty states, error/not-found states, generateMetadata, responsive phone layout (390px) per DESIGN.md, accessibility per §9. Then verify: cd ${R}/web && npx tsc --noEmit (zero errors) && npx eslint <your files> (zero errors). Screenshot every route you own at 1440x900 and 390x844 (full page) with real data (pick realistic slugs/ids by querying the DB: PGPASSWORD=coach psql -h localhost -U coach -d coachnet), LOOK at each image, compare against DESIGN.md and the reference PNGs, and fix what is off. Iterate at least twice. Return: files created, routes, screenshot paths, known gaps.`, { label: `build:${f.key}`, phase: 'Build' }),
  (report, f) => reviewAndFix(f, report, 1),
  (report, f) => reviewAndFix(f, report, 2),
)

async function reviewAndFix(f, report, round) {
  if (!report) return report
  const [design, domain] = await parallel([
    () => agent(`${CTX}\n\nYou are a principal product designer (ex-LinkedIn, ex-Linear) reviewing the "${f.key}" screens (routes: ${f.routes}). Builder report:\n${report}\n\nTake fresh full-page screenshots of each route at 1440x900 and 390x844 with real data (save to ${R}/design/screens/${f.key}/review${round}-*.png) and LOOK at them beside the reference PNGs. Check DESIGN.md §11 UI quality bar rule by rule, spacing rhythm, alignment, hierarchy, type scale, truncation, empty/loading states, dark mode tokens, phone layout and tab bar. Be strict and specific. pass=true only with zero blocker/major issues.`, { label: `review:${f.key}:design${round}`, phase: 'Review', schema: REVIEW_SCHEMA }),
    () => agent(`${CTX}\n\nYou are a veteran college athletic director and former assistant coach, plus a careful QA engineer, reviewing the "${f.key}" screens (routes: ${f.routes}). Builder report:\n${report}\n\nUse the screens (fresh screenshots at 1440 and 390; LOOK at them) and the HTML (curl, with and without -b 'cn_demo_session=coach' and 'cn_demo_session=employer'). Check: is every number/fact correct against the database (psql)? Do links go to real pages (no 404s; curl each link you find)? Are sparse records (no years, no bio, no tree) handled gracefully and honestly? Are demo/sample labels present where required? Would a coach or AD find this useful and credible? Any runtime errors in the dev server log (${R}/../tmp is not it; check curl responses for error overlays)? Be strict and specific. pass=true only with zero blocker/major issues.`, { label: `review:${f.key}:domain${round}`, phase: 'Review', schema: REVIEW_SCHEMA }),
  ])
  const issues = [...(design?.issues ?? []), ...(domain?.issues ?? [])]
  log(`${f.key} round ${round}: design ${design?.pass ? 'pass' : 'fail'}, domain ${domain?.pass ? 'pass' : 'fail'}, ${issues.length} issues`)
  if (!issues.length) return report
  return agent(`${CTX}\n\nYou built the "${f.key}" feature (routes: ${f.routes}). Reviewers found these issues. Fix ALL blocker and major issues and as many minor ones as are consistent with DESIGN.md:\n${JSON.stringify(issues, null, 1)}\n\nStay inside your owned files. Re-verify: tsc and eslint zero errors, fresh screenshots you look at. Return a summary of what changed and anything you could not fix (with reason).`, { label: `fix:${f.key}:${round}`, phase: 'Review' })
}

return results.map((r, i) => ({ feature: features[i].key, report: r }))
