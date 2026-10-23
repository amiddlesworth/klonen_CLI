// Usage: node tools/screenshot.mjs <url-or-file> <out.png> [width=1440] [height=900] [fullPage=1]
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
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const url = /^https?:/.test(target) ? target : 'file://' + resolve(target);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: full === '1' });
await browser.close();
console.log('saved', out);
