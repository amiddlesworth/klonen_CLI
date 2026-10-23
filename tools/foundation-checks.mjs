// Foundation checks: Playwright assertions on the running app for shell and primitive rules that
// screenshots miss. Exits 1 when any check fails.
//
// Usage: node tools/foundation-checks.mjs [baseUrl=http://localhost:3000]
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:3000';
const exe = (() => {
  const base = '/opt/pw-browsers';
  if (!existsSync(base)) return undefined;
  if (existsSync(base + '/chromium')) return base + '/chromium';
  const d = readdirSync(base).find((n) => n.startsWith('chromium-'));
  return d ? `${base}/${d}/chrome-linux/chrome` : undefined;
})();
const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: exe }));

let failures = 0;
let passes = 0;
function check(name, ok, detail = '') {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `\n       ${detail}` : ''}`);
}

async function open(width, { as = null, path, mobile = width <= 720 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
  if (as) await context.addCookies([{ name: 'cn_demo_session', value: as, domain: new URL(BASE).hostname, path: '/' }]);
  const page = await context.newPage();
  // #fold keeps the phone tab bar fixed (no capture aid), as real users see it.
  await page.goto(BASE + path + (mobile ? '#fold' : ''), { waitUntil: 'networkidle' });
  return { page, context };
}

/**
 * Every visible [role=menuitem] whose first child is an icon: the icon's vertical centre must be
 * within 1px of the centre of the label's first text line.
 */
async function menuIconOffsets(page) {
  return page.evaluate(() => {
    const out = [];
    for (const item of document.querySelectorAll('[role="menuitem"]')) {
      if (!item.getClientRects().length) continue;
      const icon = item.firstElementChild;
      if (!icon || icon.tagName.toLowerCase() !== 'svg') continue;
      const label = item.querySelector(':scope > span > span') ?? item.querySelector(':scope > span');
      if (!label) continue;
      const ir = icon.getBoundingClientRect();
      const lr = label.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(label).lineHeight) || lr.height;
      const iconCentre = ir.top + ir.height / 2;
      const lineCentre = lr.top + Math.min(lh, lr.height) / 2;
      out.push({ text: label.textContent.trim().slice(0, 40), iconCentre, lineCentre, delta: +(iconCentre - lineCentre).toFixed(2) });
    }
    return out;
  });
}

function assertIcons(name, rows) {
  const bad = rows.filter((r) => Math.abs(r.delta) > 1);
  check(`${name}: ${rows.length} menu item icons centred on their first text line (±1px)`, rows.length > 0 && bad.length === 0,
    rows.length === 0 ? 'no menu items with icons found' : bad.map((r) => `"${r.text}" icon ${r.iconCentre.toFixed(1)} vs text ${r.lineCentre.toFixed(1)}`).join('; '));
}

/** Footer links (and other links outside sentences in the footer) are at least 24px tall. */
async function footerLinkHeights(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('footer nav[aria-label="Footer"] a')]
      .filter((a) => a.getClientRects().length)
      .map((a) => ({ text: a.textContent.trim(), h: +a.getBoundingClientRect().height.toFixed(1) })),
  );
}

// 1. Menu icons: Me menu (signed in), Sign in menu (signed out), gallery menus, at 390 and 1440.
for (const width of [390, 1440]) {
  {
    const { page, context } = await open(width, { as: 'coach', path: '/feed' });
    const trigger = width <= 720 ? page.locator('[data-tabbar] button[aria-label="Me menu"]') : page.locator('header button[aria-label="Me menu"]').first();
    await trigger.click();
    await page.waitForSelector('[role="menu"][aria-label="Me"]');
    assertIcons(`${width} Me menu`, await menuIconOffsets(page));
    // Keyboard: opening from the trigger focuses the first item, not the checked radio.
    await page.keyboard.press('Escape');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('[role="menu"][aria-label="Me"]');
    await page.waitForTimeout(100);
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      const first = document.querySelector('[role="menu"][aria-label="Me"] [role^="menuitem"]');
      return { isFirst: el === first, text: el?.textContent?.trim().slice(0, 40), role: el?.getAttribute('role') };
    });
    check(`${width} Me menu: ArrowDown on the trigger focuses the first item`, focused.isFirst, `focused ${focused.role} "${focused.text}"`);
    await context.close();
  }
  {
    const { page, context } = await open(width, { path: '/jobs' });
    await page.getByRole('button', { name: 'Sign in' }).first().click();
    await page.waitForSelector('[role="menu"]');
    const rows = await menuIconOffsets(page);
    // The sign-in menu has icons only in the phone sheet (For employers links).
    if (width <= 720) assertIcons(`${width} Sign in sheet`, rows);
    else check(`${width} Sign in menu: icon offsets (if any) within 1px`, rows.every((r) => Math.abs(r.delta) <= 1), JSON.stringify(rows));
    await context.close();
  }
  {
    const { page, context } = await open(width, { as: 'coach', path: '/dev/components' });
    assertIcons(`${width} gallery static menus`, await menuIconOffsets(page));
    const live = page.getByRole('button', { name: 'More options' }).first();
    await live.scrollIntoViewIfNeeded();
    await live.click();
    await page.waitForTimeout(200);
    assertIcons(`${width} gallery live menu`, await menuIconOffsets(page));
    // Destructive menu items use --danger, not ink.
    const danger = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--danger)';
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      const item = [...document.querySelectorAll('[role="menuitem"]')].find((el) => el.textContent.trim() === 'Remove from pipeline');
      return { want, got: item ? getComputedStyle(item).color : null };
    });
    check(`${width} destructive menu item uses --danger`, danger.got === danger.want, `got ${danger.got}, want ${danger.want}`);
    await context.close();
  }
}

// 2. Legal footer links are 24px targets (§11 rule 7), at 390 and 1440.
for (const width of [390, 1440]) {
  for (const [as, path] of [['coach', '/feed'], [null, '/jobs'], ['coach', '/settings']]) {
    const { page, context } = await open(width, { as, path });
    const links = await footerLinkHeights(page);
    const short = links.filter((l) => l.h < 24);
    // The phone feed drops its right rail, and the footer with it.
    if (!links.length && width <= 720 && path === '/feed') {
      await context.close();
      continue;
    }
    check(`${width} ${path}: ${links.length} footer links at least 24px tall`, links.length > 0 && short.length === 0, short.map((l) => `${l.text} ${l.h}px`).join(', '));
    await context.close();
  }
}

// 3. The "/" hint hides while the nav search field has focus (1440).
{
  const { page, context } = await open(1440, { as: 'coach', path: '/feed' });
  const field = page.locator('header input[type="search"]').first();
  const kbdVisible = () => field.evaluate((el) => {
    const k = el.closest('label')?.querySelector('kbd');
    return !!k && k.getClientRects().length > 0;
  });
  const before = await kbdVisible();
  await field.click();
  await field.fill('falconer');
  const after = await kbdVisible();
  check('1440 search: "/" hint shown at rest, hidden while focused', before && !after, `rest ${before}, focused ${after}`);
  await context.close();
}

// 4. The first card starts at the same height in every layout (1440): no jump between nav tabs.
{
  const tops = {};
  for (const [as, path] of [['coach', '/feed'], ['coach', '/network'], ['coach', '/jobs'], ['coach', '/settings'], ['coach', '/search'], ['coach', '/messaging']]) {
    const { page, context } = await open(1440, { as, path });
    tops[path] = await page.evaluate(() => {
      const main = document.getElementById('main');
      // Skip visually hidden children (an sr-only h1 is absolutely positioned, 1px).
      const first = [...(main?.children ?? [])].find((el) => getComputedStyle(el).position !== 'absolute' && el.getBoundingClientRect().height > 1);
      return first ? Math.round(first.getBoundingClientRect().top + window.scrollY) : null;
    });
    await context.close();
  }
  const values = Object.values(tops).filter((v) => v !== null);
  check('1440 first card top is the same in every layout', values.length > 1 && values.every((v) => v === values[0]), JSON.stringify(tops));
}

// 5. No horizontal scroll at 390 on a touch phone (§11 rule 12) through the claim flow, signed out.
//    Touch matters: pointer-coarse hit areas (Button size="sm") can reach past the page edge.
{
  const { page, context } = await open(390, { path: '/claim/ian-falconer' });
  const width = () => page.evaluate(() => document.documentElement.scrollWidth);
  check('390 touch claim step 1: scrollWidth is 390', (await width()) === 390, `scrollWidth ${await width()}`);
  await page.fill('#claim-email', 'coach@school.edu');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('6-digit code').fill('123456');
  // Any six digits verify, and verifying moves straight to step 2.
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.getByRole('heading', { name: /review your career/i }).waitFor();
  check('390 touch claim step 2: scrollWidth is 390', (await width()) === 390, `scrollWidth ${await width()}`);
  await context.close();
}

await browser.close();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
