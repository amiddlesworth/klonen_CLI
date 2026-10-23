import { chromium } from 'playwright';
const D = '/home/user/klonen_cli/design/screens/employer';
const browser = await chromium.launch();
for (const [w, h, theme] of [[390, 844, 'light'], [390, 844, 'dark'], [1440, 900, 'light']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
  await ctx.addCookies([{ name: 'cn_demo_session', value: 'employer', domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/employers/pipeline#fold', { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector('article[id^="candidate-"]', { timeout: 90000 });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Add candidate' }).click();
  await page.waitForTimeout(400);
  for (const term of ['Gil', 'Avery', 'zzqx']) {
    const input = page.locator('dialog input[type=search]');
    await input.fill(term);
    await page.waitForFunction(() => !document.querySelector('dialog [aria-busy="true"]'), null, { timeout: 60000 });
    await page.waitForTimeout(300);
    const tag = `${w}${theme === 'dark' ? '-dark' : ''}`;
    await page.screenshot({ path: `${D}/review2-add-${term.toLowerCase()}-${tag}.png` });
    const info = await page.evaluate(() => [...document.querySelectorAll('dialog li')].map((li) => { const m = li.querySelector('.truncate.text-caption'); return li.textContent.trim().slice(0, 80) + (m && m.scrollWidth > m.clientWidth ? '  [TRUNCATED]' : ''); }));
    console.log(tag, term, JSON.stringify(info));
  }
  await ctx.close();
}
await browser.close();
