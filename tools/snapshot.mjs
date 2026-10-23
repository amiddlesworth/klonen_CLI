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

let sharedCssWritten = false;
for (const [i, p] of pages.entries()) {
  const headers = p.as ? { cookie: `cn_demo_session=${p.as}` } : {};
  const res = await fetch(new URL(p.path, base), { headers, redirect: 'follow' });
  let html = await res.text();
  // Collect stylesheets into one shared file.
  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  if (!sharedCssWritten && hrefs.length) {
    const css = (await Promise.all(hrefs.map(inlineCss))).join('\n');
    writeFileSync(join(out, 'app.css'), css);
    sharedCssWritten = true;
  }
  html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/g, '');
  html = html.replace(/<link[^>]+rel="(preload|modulepreload|prefetch)"[^>]*>/g, '');
  html = html.replace(/<script[\s\S]*?<\/script>/g, '');
  html = html.replace('</head>', '<link rel="stylesheet" href="app.css"><meta name="robots" content="noindex"></head>');
  // Rewrite internal links.
  html = html.replace(/href="(\/[^"]*)"/g, (_m, href) => {
    const path = href.split('#')[0];
    const hash = href.includes('#') ? '#' + href.split('#')[1] : '';
    const target = known.get(path) ?? known.get(path.split('?')[0]);
    return `href="${target ? target + hash : 'not-in-demo.html'}"`;
  });
  // Forms cannot submit in a static snapshot.
  html = html.replace(/<form([^>]*)>/g, '<form$1 onsubmit="return false">');
  writeFileSync(join(out, fileFor(p.path, i)), html);
  process.stdout.write(`${i + 1}/${pages.length} ${p.path} -> ${fileFor(p.path, i)} (${res.status})\n`);
}

writeFileSync(
  join(out, 'not-in-demo.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not in this demo</title><link rel="stylesheet" href="app.css"></head>
<body style="display:grid;place-items:center;min-height:100vh;font-family:system-ui;padding:24px;text-align:center">
<div><h1 style="font-size:20px;margin:0 0 8px">This page isn't in the demo snapshot</h1>
<p style="margin:0 0 16px;color:#666">The demo includes a curated set of pages. The full app runs locally with the complete dataset.</p>
<a href="index.html">Back to the demo</a></div></body></html>`,
);
console.log('done:', pages.length, 'pages');
