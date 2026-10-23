// Static snapshot of the running app for a private, read-only demo link.
//
// Fetches server-rendered pages, keeps their HTML and CSS (fonts inlined as
// data URIs), strips scripts, and rewrites internal links to flat file names.
// Links to pages outside the snapshot point to not-in-demo.html.
//
// Usage: node tools/snapshot.mjs <baseUrl> <outDir> <pages.json>
//   pages.json: [{ "path": "/in/jane-doe", "as": "coach" | "employer" | null }, ...]
//   The first entry becomes index.html.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [, , base, out, listFile] = process.argv;
const pages = JSON.parse(readFileSync(listFile, 'utf8'));
mkdirSync(out, { recursive: true });

const fileFor = (path, i) => {
  if (i === 0) return 'index.html';
  const clean = path.replace(/^\//, '').replace(/[?&=]/g, '_').replace(/[^a-zA-Z0-9_\-/.]/g, '');
  return (clean.replace(/\//g, '--') || 'home') + '.html';
};
const known = new Map(pages.map((p, i) => [p.path, fileFor(p.path, i)]));

const cssCache = new Map();
async function inlineCss(href) {
  if (cssCache.has(href)) return cssCache.get(href);
  let css = await (await fetch(new URL(href, base))).text();
  // Inline font files referenced by url(...) so the page is self-contained.
  const urls = [...css.matchAll(/url\((\/_next\/static\/media\/[^)]+)\)/g)].map((m) => m[1]);
  for (const u of new Set(urls)) {
    const buf = Buffer.from(await (await fetch(new URL(u, base))).arrayBuffer());
    const type = u.endsWith('.woff2') ? 'font/woff2' : u.endsWith('.woff') ? 'font/woff' : 'application/octet-stream';
    css = css.split(`url(${u})`).join(`url(data:${type};base64,${buf.toString('base64')})`);
  }
  cssCache.set(href, css);
  return css;
}

// Pages stream content through React Suspense; the swap from skeleton to content
// runs in inline scripts. Render each page in a real browser, wait for the stream
// to finish, and keep the final DOM.
const browser = await chromium.launch();
const contexts = {};
async function ctxFor(as) {
  const key = as ?? 'none';
  if (!contexts[key]) {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    if (as) await c.addCookies([{ name: 'cn_demo_session', value: as, domain: new URL(base).hostname, path: '/' }]);
    contexts[key] = c;
  }
  return contexts[key];
}

let cssPromise = null;
async function snapOne(p, i) {
  const page = await (await ctxFor(p.as)).newPage();
  const res = await page.goto(new URL(p.path, base).toString(), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('template[id^="B:"]'), null, { timeout: 15000 }).catch(() => {});
  let html = '<!doctype html>' + (await page.evaluate(() => document.documentElement.outerHTML));
  await page.close();
  // Collect stylesheets into one shared file (once).
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  if (!cssPromise && hrefs.length) {
    cssPromise = Promise.all(hrefs.map(inlineCss)).then((parts) => writeFileSync(join(out, 'app.css'), parts.join('\n')));
  }
  html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/g, '');
  html = html.replace(/<link[^>]+rel="(preload|modulepreload|prefetch)"[^>]*>/g, '');
  html = html.replace(/<script[\s\S]*?<\/script>/g, '');
  html = html.replace('</head>', '<link rel="stylesheet" href="app.css"><meta name="robots" content="noindex"></head>');
  html = html.replace(/href="(\/[^"]*)"/g, (_m, href) => {
    const path = href.split('#')[0];
    const hash = href.includes('#') ? '#' + href.split('#')[1] : '';
    const target = known.get(path) ?? known.get(path.split('?')[0]);
    return `href="${target ? target + hash : 'not-in-demo.html'}"`;
  });
  html = html.replace(/<form([^>]*)>/g, '<form$1 onsubmit="return false">');
  writeFileSync(join(out, fileFor(p.path, i)), html);
  process.stdout.write(`${i + 1}/${pages.length} ${p.path} -> ${fileFor(p.path, i)} (${res?.status()})\n`);
}

// Six pages at a time; each page is independent.
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < pages.length) {
    const i = next++;
    try { await snapOne(pages[i], i); } catch (e) { process.stdout.write(`${i + 1}/${pages.length} ${pages[i].path} FAILED ${e.message}\n`); }
  }
}));
await cssPromise;

writeFileSync(
  join(out, 'not-in-demo.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not in this demo</title><link rel="stylesheet" href="app.css"></head>
<body style="display:grid;place-items:center;min-height:100vh;font-family:system-ui;padding:24px;text-align:center">
<div><h1 style="font-size:20px;margin:0 0 8px">This page isn't in the demo snapshot</h1>
<p style="margin:0 0 16px;color:#666">The demo includes a curated set of pages. The full app runs locally with the complete dataset.</p>
<a href="index.html">Back to the demo</a></div></body></html>`,
);
await browser.close();
console.log('done:', pages.length, 'pages');
