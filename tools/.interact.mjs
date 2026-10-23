import { chromium } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([
  { name: 'cn_demo_session', value: 'coach', domain: 'localhost', path: '/' },
  { name: 'cn_follows', value: encodeURIComponent(JSON.stringify({ 'u-demo-coach': ['ncaa-2751', 'ncaa-452'] })), domain: 'localhost', path: '/' },
]);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
await page.goto('http://localhost:3000/feed', { waitUntil: 'networkidle', timeout: 90000 });
// Save a job from the job card, then check the shortcut count.
await page.getByRole('button', { name: /Save job: Defensive Backs Coach/ }).first().click();
await page.waitForTimeout(400);
const shortcuts = page.getByRole('navigation', { name: 'Shortcuts' });
console.log('shortcuts:', (await shortcuts.innerText()).replace(/\n+/g, ' | '));
await shortcuts.getByText('Programs I follow').click();
await shortcuts.getByText('Saved jobs').click();
await page.waitForTimeout(300);
await shortcuts.screenshot({ path: out + '/fix3-shortcuts-open.png' });
// More menu on the second card (a promotion): Save, then hide promotions.
const more = page.getByRole('button', { name: /More options for Greg Polis/ });
await more.click();
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/fix3-more-menu-1440.png', clip: { x: 380, y: 300, width: 620, height: 420 } });
console.log('menu:', (await page.getByRole('menu').innerText()).replace(/\n+/g, ' | '));
await page.getByRole('menuitem', { name: /Hide moves like this/ }).click();
await page.waitForTimeout(400);
console.log('focused:', await page.evaluate(() => document.activeElement?.textContent));
console.log('placeholders:', await page.getByText(/are hidden from your feed/).count(), 'Josh Hoeg visible:', await page.getByText('Josh Hoeg', { exact: true }).count());
await page.screenshot({ path: out + '/fix3-hidden-1440.png', fullPage: false });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
console.log('after reload placeholders:', await page.getByText(/are hidden from your feed/).count(), 'Greg Polis:', await page.getByText('Greg Polis', { exact: true }).count(), 'Josh Hoeg:', await page.getByText('Josh Hoeg', { exact: true }).count());
await page.screenshot({ path: out + '/fix3-hidden-reload-1440.png', fullPage: false });
await page.getByRole('button', { name: 'Show again' }).first().click();
await page.waitForTimeout(400);
console.log('after show again:', await page.getByText(/are hidden from your feed/).count(), 'Greg Polis:', await page.getByText('Greg Polis', { exact: true }).count());
// Me menu at 900
await page.setViewportSize({ width: 900, height: 900 });
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^Me/ }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: out + '/fix3-900-me-menu.png' });
await browser.close();
