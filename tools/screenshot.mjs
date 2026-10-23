// Usage: [COOKIE='cn_demo_session=coach'] [THEME=dark] node tools/screenshot.mjs <url-or-file> <out.png> [width=1440] [height=900] [fullPage=1]
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [,, target, out, w = '1440', h = '900', full = '1'] = process.argv;
const exe = (() => {
  const base = '/opt/pw-browsers';
  if (existsSync(base + '/chromium')) return base + '/chromium';
  const d = readdirSync(base).find((n) => n.startsWith('chromium-'));
  return d ? `${base}/${d}/chrome-linux/chrome` : undefined;
})();
const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: exe }));
const context = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light' });
if (process.env.COOKIE && /^https?:/.test(target)) {
  const u = new URL(target);
  await context.addCookies(process.env.COOKIE.split(';').map((c) => {
    const [name, ...v] = c.trim().split('=');
    return { name, value: v.join('='), domain: u.hostname, path: '/' };
  }));
}
const page = await context.newPage();
const url = /^https?:/.test(target) ? target : 'file://' + resolve(target);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: full === '1' });
await browser.close();
console.log('saved', out);
