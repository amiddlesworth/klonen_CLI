import { chromium } from 'playwright';
const urls = process.argv.slice(2);
const browser = await chromium.launch();
for (const cookie of [null, 'coach', 'employer']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (cookie) await ctx.addCookies([{ name: 'cn_demo_session', value: cookie, domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  for (const w of [360, 390, 721, 900, 1081, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const u of urls) {
      await page.goto('http://localhost:3000' + u, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(1500);
      const r = await page.evaluate(() => {
        const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
        // find small text
        const small = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!el.childNodes.length) continue;
          const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
          if (!hasText) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect(); if (!r.width) continue;
          const fs = parseFloat(cs.fontSize);
          if (fs < 12 && !el.closest('[aria-hidden="true"]') && !el.closest('.sr-only')) small.push(el.tagName + ':' + fs + ':' + el.textContent.trim().slice(0,20));
          if (cs.textTransform === 'uppercase') small.push('UPPER:' + el.textContent.trim().slice(0,20));
        }
        return { sw, cw, small: small.slice(0, 5) };
      });
      if (r.sw > r.cw || r.small.length) console.log(cookie, w, u, JSON.stringify(r));
    }
  }
  await ctx.close();
}
await browser.close();
console.log('done');
