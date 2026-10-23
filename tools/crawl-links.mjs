// Link crawler / page audit: breadth-first crawl of the running app as one or more demo viewers.
//
// For every page reached through internal <a href> links it records:
//   - HTTP status other than 200/307/308 (network errors are status 0)
//   - Next.js / React error markers in the HTML: <html id="__next_error__">, data-next-error-message,
//     Suspense boundaries that errored on the server (<!--$!--> + data-dgst / $RX), dev overlay markup,
//     "Application error" text, soft 404s (200 + <meta name="next-error" content="not-found">)
//   - h1 count != 1 (counted after resolving React streaming: $RC / $RS segments are applied, the
//     replaced Suspense fallbacks are dropped, [hidden] / <template> subtrees are ignored), checked per
//     viewport width (--widths, default 390,1280) by resolving Tailwind hidden / md:hidden / max-md:hidden
//     statically, so a phone-only sr-only h1 paired with a desktop h1 is reported as info, not a failure
//   - <a href> with an empty accessible name (aria-labelledby, aria-label, text, img alt, svg <title>, title)
//   - inline ErrorState blocks (role="alert") so error UIs that still return 200 show up
// Connection errors are retried with backoff (a `next dev` worker restarts when files change), and
// pages that fail hard are re-fetched once at the end; ones that come back clean are listed as flaky.
// 3xx bodies (Next's redirect shell) are not analysed.
//
// Optional --browser N loads up to N pages (seeds first, then one per route pattern) in Chromium and
// records page errors, console errors, "Application error" and the Next dev overlay's issue badge.
//
// Usage:
//   node tools/crawl-links.mjs [--base http://localhost:3000] [--max 400] [--concurrency 4]
//     [--viewer anon=] [--viewer coach=coach] [--viewer employer=employer]  (name=cookie value; empty = no cookie)
//     [--cookie-name cn_demo_session] [--seed /feed ...] [--skip /dev/ ...] [--json out.json]
//     [--browser 0] [--app-dir web/src/app] [--widths 390,1280] [--timeout 90000] [--quiet]
//     [--from-json prev.json]   re-report a previous --json run (with --browser N: re-run only the browser pass)
// Exit code: 1 when any finding is recorded, 0 otherwise.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
let WIDTHS = [390, 1280]; // viewport widths for the static Tailwind h1 visibility check (--widths)

// ---------------------------------------------------------------- args
function parseArgs(argv) {
  const o = { base: 'http://localhost:3000', max: 400, concurrency: 4, viewers: [], seeds: [], skip: [], json: null, browser: 0, appDir: null, cookieName: 'cn_demo_session', quiet: false, timeout: 90000, fromJson: null, widths: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--base') o.base = next();
    else if (a === '--max') o.max = +next();
    else if (a === '--concurrency') o.concurrency = +next();
    else if (a === '--viewer') o.viewers.push(next());
    else if (a === '--seed') o.seeds.push(next());
    else if (a === '--skip') o.skip.push(next());
    else if (a === '--json') o.json = next();
    else if (a === '--browser') o.browser = +next();
    else if (a === '--app-dir') o.appDir = next();
    else if (a === '--cookie-name') o.cookieName = next();
    else if (a === '--timeout') o.timeout = +next();
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--from-json') o.fromJson = next();
    else if (a === '--widths') o.widths = next().split(',').map(Number);
    else if (a === '-h' || a === '--help') {
      console.log(readHelp());
      process.exit(0);
    } else throw new Error(`unknown arg ${a}`);
  }
  if (!o.viewers.length) o.viewers = ['anon=', 'coach=coach', 'employer=employer'];
  if (!o.seeds.length) o.seeds = ['/', '/feed', '/search?q=coach', '/jobs', '/programs/pacific-or', '/in/ian-falconer', '/employers/pipeline', '/messaging'];
  if (!o.skip.length) o.skip = ['/dev/', '/_next/'];
  o.viewers = o.viewers.map((v) => {
    const [name, ...rest] = v.split('=');
    return { name, cookie: rest.join('=') || null };
  });
  return o;
}
function readHelp() {
  return 'See the header comment of tools/crawl-links.mjs for options.';
}

// ---------------------------------------------------------------- HTML parsing (React SSR output is well formed)
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const TOKEN = /<!--([\s\S]*?)-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
const ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function decode(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    if (k === 'nbsp') return ' ';
    const cp = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    try {
      return String.fromCodePoint(cp);
    } catch {
      return m;
    }
  });
}

function parseAttrs(s) {
  const attrs = {};
  if (!s) return attrs;
  ATTR.lastIndex = 0;
  let m;
  while ((m = ATTR.exec(s))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

function parseHtml(html) {
  const root = { type: 'el', tag: '#root', attrs: {}, children: [], parent: null };
  const byId = new Map();
  const scripts = [];
  let cur = root;
  let last = 0;
  const pushText = (t) => {
    if (t) cur.children.push({ type: 'text', text: decode(t), parent: cur });
  };
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(html))) {
    pushText(html.slice(last, m.index));
    last = TOKEN.lastIndex;
    if (m[1] !== undefined) {
      cur.children.push({ type: 'comment', text: m[1], parent: cur });
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      let n = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n.parent) cur = n.parent;
    } else if (m[3]) {
      const tag = m[3].toLowerCase();
      const el = { type: 'el', tag, attrs: parseAttrs(m[4]), children: [], parent: cur };
      cur.children.push(el);
      if (el.attrs.id) byId.set(el.attrs.id, el);
      if (RAW.has(tag) && !m[5]) {
        const close = new RegExp(`</${tag}\\s*>`, 'ig');
        close.lastIndex = last;
        const c = close.exec(html);
        const end = c ? c.index : html.length;
        el.raw = html.slice(last, end);
        if (tag === 'script') scripts.push(el.raw);
        else if (tag !== 'style') el.children.push({ type: 'text', text: decode(el.raw), parent: el });
        last = c ? close.lastIndex : html.length;
        TOKEN.lastIndex = last;
      } else if (!VOID.has(tag) && !m[5]) {
        cur = el;
      }
    }
  }
  pushText(html.slice(last));
  return { root, byId, scripts };
}

function setChildren(parent, start, deleteCount, nodes) {
  for (const n of nodes) n.parent = parent;
  parent.children.splice(start, deleteCount, ...nodes);
}
function detach(node) {
  const p = node.parent;
  if (!p) return;
  const i = p.children.indexOf(node);
  if (i >= 0) p.children.splice(i, 1);
  node.parent = null;
}
const isOpen = (n) => n.type === 'comment' && (n.text === '$' || n.text === '$?' || n.text === '$!');
const isClose = (n) => n.type === 'comment' && n.text === '/$';

/** Applies React Fizz streaming instructions so the tree matches the DOM after the inline scripts ran. */
function resolveStreaming(doc) {
  const issues = [];
  const instr = [];
  const RE = /\$R([CSRX])\(((?:\s*(?:"(?:[^"\\]|\\.)*"|\[[^\]]*\]|null)\s*,?)*)\)/g;
  for (const s of doc.scripts) {
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(s))) {
      let args;
      try {
        args = JSON.parse(`[${m[2].replace(/,\s*$/, '')}]`);
      } catch {
        continue;
      }
      instr.push({ op: m[1], args });
    }
  }
  for (const { op, args } of instr) {
    if (op === 'S') {
      const [sid, pid] = args;
      const s = doc.byId.get(sid);
      const p = doc.byId.get(pid);
      if (!s || !p || !p.parent) {
        issues.push(`unresolved segment ${sid}->${pid}`);
        continue;
      }
      const kids = s.children.slice();
      detach(s);
      const par = p.parent;
      setChildren(par, par.children.indexOf(p), 1, kids);
    } else if (op === 'C' || op === 'R') {
      const [bid, sid] = args;
      const b = doc.byId.get(bid);
      const s = doc.byId.get(sid);
      if (!b || !s || !b.parent) {
        issues.push(`unresolved boundary ${bid}->${sid}`);
        continue;
      }
      const par = b.parent;
      const i = par.children.indexOf(b);
      let depth = 0;
      let end = par.children.length;
      for (let j = i + 1; j < par.children.length; j++) {
        const n = par.children[j];
        if (isOpen(n)) depth++;
        else if (isClose(n)) {
          if (depth === 0) {
            end = j;
            break;
          }
          depth--;
        }
      }
      const opener = par.children[i - 1];
      if (opener && opener.type === 'comment') opener.text = '$';
      const kids = s.children.slice();
      detach(s);
      setChildren(par, i, end - i, kids);
    } else if (op === 'X') {
      const [bid, dgst, msg] = args;
      issues.push(`client-render boundary ${bid}: ${msg || dgst || '(no message)'}`);
    }
  }
  return issues;
}

const SKIP_TAGS = new Set(['script', 'style', 'template', 'noscript', 'head']);
const hiddenEl = (el) => el.type === 'el' && ('hidden' in el.attrs || SKIP_TAGS.has(el.tag));

function* walk(node) {
  for (const c of node.children) {
    if (c.type !== 'el') continue;
    if (hiddenEl(c)) continue;
    yield c;
    yield* walk(c);
  }
}

function textOf(node, { skipAriaHidden = false } = {}) {
  let out = '';
  for (const c of node.children) {
    if (c.type === 'text') out += c.text;
    else if (c.type === 'el') {
      if (hiddenEl(c)) continue;
      if (skipAriaHidden && c.attrs['aria-hidden'] === 'true') continue;
      out += textOf(c, { skipAriaHidden });
    }
  }
  return out;
}

/** Accessible name per the accname algorithm, simplified for links. */
function accName(el, byId) {
  const lb = el.attrs['aria-labelledby'];
  if (lb) {
    const t = lb
      .split(/\s+/)
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((n) => textOf(n))
      .join(' ')
      .trim();
    if (t) return t;
  }
  const al = (el.attrs['aria-label'] || '').trim();
  if (al) return al;
  const content = nameFromContent(el).replace(/\s+/g, ' ').trim();
  if (content) return content;
  return (el.attrs.title || '').trim();
}
function nameFromContent(node) {
  let out = '';
  for (const c of node.children) {
    if (c.type === 'text') out += c.text;
    else if (c.type === 'el') {
      if (hiddenEl(c) || c.attrs['aria-hidden'] === 'true') continue;
      if (c.attrs['aria-label']?.trim()) out += ' ' + c.attrs['aria-label'] + ' ';
      else if (c.tag === 'img') out += ' ' + (c.attrs.alt || '') + ' ';
      else if (c.tag === 'svg') {
        const t = c.children.find((k) => k.type === 'el' && k.tag === 'title');
        if (t) out += ' ' + textOf(t) + ' ';
      } else out += ' ' + nameFromContent(c) + ' ';
    }
  }
  return out;
}

/** Ancestor class tokens that hide the element at some breakpoint (Tailwind hidden / sm:hidden / sr-only…). */
function cssHint(el) {
  const hints = new Set();
  for (let n = el; n && n.tag !== '#root'; n = n.parent) {
    for (const t of (n.attrs?.class || '').split(/\s+/)) {
      if (/^(?:[a-z0-9-]+:)*(hidden|sr-only|invisible)$/.test(t)) hints.add(t);
    }
  }
  return [...hints];
}

/**
 * Static Tailwind display check: is `el` displayed (to the accessibility tree too, so sr-only counts as
 * shown) at viewport `width`, judging by hidden / block / flex… utilities with sm/md/lg/xl/2xl and
 * max-* prefixes on it and its ancestors? Arbitrary variants (group-*, data-*, aria-*) are ignored.
 */
const BP = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };
const DISPLAY = /^(hidden|block|flex|inline|inline-block|inline-flex|grid|inline-grid|table|contents|flow-root|list-item)$/;
function shownAt(el, width) {
  for (let n = el; n && n.tag !== '#root'; n = n.parent) {
    const cls = (n.attrs?.class || '').split(/\s+/).filter(Boolean);
    const steps = { display: [], visibility: [] };
    for (const t of cls) {
      const parts = t.split(':');
      const util = parts.pop();
      const kind = DISPLAY.test(util) ? 'display' : util === 'invisible' || util === 'visible' ? 'visibility' : null;
      if (!kind) continue;
      if (parts.length > 1) continue;
      const v = parts[0];
      let order;
      if (!v) order = 0;
      else if (v.startsWith('max-') && BP[v.slice(4)]) {
        if (width >= BP[v.slice(4)]) continue;
        order = 1;
      } else if (BP[v]) {
        if (width < BP[v]) continue;
        order = 2 + BP[v];
      } else continue;
      steps[kind].push([order, util]);
    }
    const last = (a) => a.sort((x, y) => x[0] - y[0]).at(-1)?.[1];
    if (last(steps.display) === 'hidden' || last(steps.visibility) === 'invisible') return false;
  }
  return true;
}

function snippetOf(el) {
  const keep = ['href', 'class', 'aria-label', 'aria-labelledby', 'title', 'role'];
  const attrs = keep
    .filter((k) => el.attrs[k] !== undefined)
    .map((k) => `${k}="${String(el.attrs[k]).slice(0, 80)}"`)
    .join(' ');
  const inner = el.children
    .filter((c) => c.type === 'el')
    .map((c) => c.tag + (c.attrs.class ? '.' + c.attrs.class.split(/\s+/).filter((x) => x.startsWith('lucide')).join('.') : ''))
    .join(',');
  return `<a ${attrs}>${inner ? `[${inner}]` : ''}</a>`;
}

// ---------------------------------------------------------------- route patterns from the Next app dir
function loadRoutePatterns(appDir) {
  const out = [];
  if (!appDir || !existsSync(appDir)) return out;
  const visit = (dir, segs) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name.startsWith('_') || name.startsWith('@')) continue;
        const seg = /^\(.*\)$/.test(name) ? null : name;
        visit(p, seg ? [...segs, seg] : segs);
      } else if (/^(page|route)\.(t|j)sx?$/.test(name)) {
        const pattern = '/' + segs.join('/');
        const re = new RegExp(
          '^' +
            segs
              .map((s) => (/^\[\[?\.\.\./.test(s) ? '(?:/.*)?' : /^\[.*\]$/.test(s) ? '/[^/]+' : '/' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
              .join('') +
            '/?$',
        );
        out.push({ pattern: pattern === '/' ? '/' : pattern, re: pattern === '/' ? /^\/?$/ : re, dyn: segs.filter((s) => s.startsWith('[')).length });
      }
    }
  };
  visit(appDir, []);
  return out.sort((a, b) => a.dyn - b.dyn);
}
function routeOf(url, patterns) {
  const u = new URL(url);
  const q = [...new Set([...u.searchParams.keys()])].sort();
  const qs = q.length ? '?' + q.map((k) => k + '=').join('&') : '';
  const hit = patterns.find((p) => p.re.test(u.pathname));
  const path = hit ? hit.pattern : u.pathname.replace(/\/\d+(?=\/|$)/g, '/:id') + ' (no route)';
  return path + qs;
}

// ---------------------------------------------------------------- fetch + analyse one page
async function fetchPage(url, viewer, opts) {
  const headers = { accept: 'text/html,application/xhtml+xml', 'user-agent': 'crawl-links/1.0' };
  if (viewer.cookie) headers.cookie = `${opts.cookieName}=${viewer.cookie}`;
  // A `next dev` worker restarts when files change; connection errors are retried with backoff after
  // waiting for the server to answer again, so a restart mid-crawl does not show up as broken links.
  const backoff = [1000, 3000, 8000, 15000, 30000];
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(opts.timeout) });
      const type = res.headers.get('content-type') || '';
      const body = type.includes('html') ? await res.text() : (await res.arrayBuffer(), '');
      return { status: res.status, location: res.headers.get('location'), type, body, ms: Date.now() - t0, retries: attempt };
    } catch (e) {
      const error = String(e.cause?.code || e.name || e);
      if (attempt >= backoff.length) return { status: 0, error, type: '', body: '', ms: Date.now() - t0, retries: attempt };
      await new Promise((r) => setTimeout(r, backoff[attempt]));
      await waitForServer(opts);
    }
  }
}
async function waitForServer(opts, maxMs = 180000) {
  const until = Date.now() + maxMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(opts.base, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(30000) });
      if (r.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

function analyse(html, pageUrl) {
  const out = { links: [], h1: [], errors: [], emptyLinks: [], alerts: [], softRedirect: null, softNotFound: false, title: '' };
  const noScripts = html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '');
  if (/<html[^>]*\bid="__next_error__"/.test(html)) out.errors.push('next-error-document (<html id="__next_error__">)');
  for (const m of html.matchAll(/data-next-error-message="([^"]*)"/g)) out.errors.push(`next-error-message: ${decode(m[1]).slice(0, 200)}`);
  if (/Application error/i.test(noScripts)) out.errors.push('"Application error" text');
  if (/nextjs-portal|data-nextjs-dialog|Unhandled Runtime Error/.test(noScripts)) out.errors.push('Next.js dev overlay markup in HTML');
  for (const m of html.matchAll(/<!--\$!--><template([^>]*)>/g)) {
    const a = parseAttrs(m[1]);
    out.errors.push(`suspense-boundary-server-error: ${(a['data-msg'] || a['data-dgst'] || '(no message)').slice(0, 200)}`);
  }
  if (/<meta name="next-error" content="not-found"/.test(html)) out.softNotFound = true;
  const refresh = html.match(/<meta[^>]*http-equiv="refresh"[^>]*content="\d+;\s*url=([^"]+)"/i);
  if (refresh) out.softRedirect = new URL(decode(refresh[1]), pageUrl).href;

  const doc = parseHtml(html);
  for (const i of resolveStreaming(doc)) out.errors.push(`streaming: ${i}`);
  const titleEl = [...walkAll(doc.root)].find((n) => n.tag === 'title');
  out.title = titleEl ? textOf({ children: titleEl.children }).trim() : '';
  const body = [...walkAll(doc.root)].find((n) => n.tag === 'body') || doc.root;
  for (const el of walk(body)) {
    if (el.tag === 'h1') out.h1.push({ text: textOf(el).replace(/\s+/g, ' ').trim().slice(0, 80), css: cssHint(el), at: Object.fromEntries(WIDTHS.map((w) => [w, shownAt(el, w)])) });
    else if (el.tag === 'a' && 'href' in el.attrs) {
      out.links.push(el.attrs.href);
      if (!accName(el, doc.byId)) out.emptyLinks.push({ href: el.attrs.href, snippet: snippetOf(el), css: cssHint(el) });
    } else if (el.attrs.role === 'alert') {
      const t = textOf(el).replace(/\s+/g, ' ').trim();
      if (t) out.alerts.push(t.slice(0, 160));
    }
  }
  return out;
}
function* walkAll(node) {
  for (const c of node.children) {
    if (c.type !== 'el') continue;
    yield c;
    yield* walkAll(c);
  }
}

// ---------------------------------------------------------------- crawl
function normalise(href, from, base, skip) {
  if (!href || /^(mailto|tel|javascript|data|sms):/i.test(href.trim())) return null;
  let u;
  try {
    u = new URL(href, from);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const b = new URL(base);
  const local = (h) => h === 'localhost' || h === '127.0.0.1';
  if (!(u.hostname === b.hostname || (local(u.hostname) && local(b.hostname))) || (u.port || '80') !== (b.port || '80')) return null;
  u.hash = '';
  u.host = b.host;
  if (skip.some((s) => u.pathname === s.replace(/\/$/, '') || u.pathname.startsWith(s))) return { skipped: true, url: u.href };
  return { url: u.href };
}

async function crawlViewer(viewer, opts, patterns) {
  const base = opts.base.replace(/\/$/, '');
  const pages = new Map(); // url -> record
  const referrers = new Map(); // url -> Set(source)
  const queue = [];
  const seen = new Set();
  const enqueue = (url, from) => {
    if (from) {
      if (!referrers.has(url)) referrers.set(url, new Set());
      referrers.get(url).add(from);
    }
    if (seen.has(url)) return;
    seen.add(url);
    queue.push(url);
  };
  for (const s of opts.seeds) enqueue(new URL(s, base + '/').href, null);
  let fetched = 0;
  let inflight = 0;
  let skippedLinks = 0;
  const worker = async () => {
    for (;;) {
      if (fetched >= opts.max) return;
      const url = queue.shift();
      if (!url) {
        if (inflight === 0) return;
        await new Promise((r) => setTimeout(r, 25));
        continue;
      }
      fetched++;
      inflight++;
      try {
        const r = await fetchPage(url, viewer, opts);
        const rec = { url, route: routeOf(url, patterns), status: r.status, ms: r.ms, error: r.error, type: r.type, retries: r.retries || undefined };
        if (r.location) {
          const n = normalise(r.location, url, base, opts.skip);
          rec.location = n ? n.url : new URL(r.location, url).href;
          if (n && !n.skipped) enqueue(n.url, url);
        }
        // A 3xx body is Next's redirect shell (<html id="__next_error__"> + meta refresh), not a page.
        if (r.body && !(r.status >= 300 && r.status < 400)) {
          const a = analyse(r.body, url);
          Object.assign(rec, { title: a.title, h1: a.h1, errors: a.errors, emptyLinks: a.emptyLinks, alerts: a.alerts, softNotFound: a.softNotFound, softRedirect: a.softRedirect, linkCount: a.links.length });
          if (a.softRedirect) {
            const n = normalise(a.softRedirect, url, base, opts.skip);
            if (n && !n.skipped) enqueue(n.url, url);
          }
          for (const href of a.links) {
            const n = normalise(href, url, base, opts.skip);
            if (!n) continue;
            if (n.skipped) {
              skippedLinks++;
              continue;
            }
            enqueue(n.url, url);
          }
        }
        pages.set(url, rec);
        if (!opts.quiet) process.stderr.write(`[${viewer.name}] ${String(fetched).padStart(3)} ${rec.status} ${String(r.ms).padStart(5)}ms ${url.replace(base, '')}${r.retries ? ` (after ${r.retries} retries)` : ''}${r.error ? ' ' + r.error : ''}\n`);
      } finally {
        inflight--;
      }
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency }, worker));
  // Re-fetch pages that failed hard (network error, 5xx, error markers) once, so transient dev-server
  // restarts / mid-edit compile errors are reported as "flaky" instead of as broken pages.
  for (const rec of pages.values()) {
    if (!(rec.status === 0 || rec.status >= 500 || (rec.errors && rec.errors.length))) continue;
    await waitForServer(opts);
    const r = await fetchPage(rec.url, viewer, opts);
    const a = r.body && !(r.status >= 300 && r.status < 400) ? analyse(r.body, rec.url) : null;
    const clean = r.status !== 0 && r.status < 500 && !(a && a.errors.length);
    rec.recheck = { status: r.status, errors: a ? a.errors : [], error: r.error };
    if (clean) {
      rec.flaky = { status: rec.status, errors: rec.errors, error: rec.error };
      Object.assign(rec, { status: r.status, error: undefined, location: r.location ? new URL(r.location, rec.url).href : undefined });
      if (a) Object.assign(rec, { title: a.title, h1: a.h1, errors: a.errors, emptyLinks: a.emptyLinks, alerts: a.alerts, softNotFound: a.softNotFound, softRedirect: a.softRedirect, linkCount: a.links.length });
    }
    if (!opts.quiet) process.stderr.write(`[${viewer.name}] recheck ${rec.recheck.status} ${clean ? '(now clean, flaky)' : '(still failing)'} ${rec.url.replace(base, '')}\n`);
  }
  return { viewer: viewer.name, pages: [...pages.values()], referrers, unvisited: queue.length, capped: fetched >= opts.max && queue.length > 0, skippedLinks };
}

// ---------------------------------------------------------------- optional browser pass
async function browserPass(viewer, result, opts, limit) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return [{ url: '-', problem: 'playwright not installed; browser pass skipped' }];
  }
  const exe = (() => {
    const b = '/opt/pw-browsers';
    if (!existsSync(b)) return undefined;
    const d = readdirSync(b).find((n) => n.startsWith('chromium-'));
    return d ? `${b}/${d}/chrome-linux/chrome` : undefined;
  })();
  const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: exe }));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (viewer.cookie) await ctx.addCookies([{ name: opts.cookieName, value: viewer.cookie, url: opts.base }]);
  const seedSet = new Set(opts.seeds.map((s) => new URL(s, opts.base + '/').href));
  const ok = result.pages.filter((p) => p.status === 200 && p.type.includes('html'));
  const picked = [];
  const routes = new Set();
  for (const p of ok) if (seedSet.has(p.url)) (picked.push(p), routes.add(p.route));
  for (const p of ok) if (!routes.has(p.route)) (picked.push(p), routes.add(p.route));
  const findings = [];
  for (const p of picked.slice(0, limit)) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${String(e.message).split('\n')[0].slice(0, 200)}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(`console.error: ${m.text().split('\n')[0].slice(0, 200)}`);
    });
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: opts.timeout });
      await page.waitForTimeout(800);
      const dom = await page.evaluate(() => {
        const portal = document.querySelector('nextjs-portal');
        const sr = portal?.shadowRoot;
        // The issues badge is always mounted in dev; only a non-zero [data-issues-count] means issues.
        const count = parseInt(sr?.querySelector('[data-issues-count]')?.textContent || '0', 10) || 0;
        const issues = count > 0 ? `${count} issue(s)` : null;
        const dialog = sr?.querySelector('[data-nextjs-dialog]') ? (sr.querySelector('[data-nextjs-dialog]').textContent || '').slice(0, 200) : null;
        const visibleH1 = [...document.querySelectorAll('h1')].filter((h) => {
          for (let n = h; n; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.display === 'none' || cs.visibility === 'hidden' || n.hasAttribute('hidden') || n.getAttribute('aria-hidden') === 'true') return false;
          }
          return true;
        }).length;
        return { appError: /Application error/.test(document.body.innerText), issues, dialog, visibleH1 };
      });
      if (dom.appError) errs.push('"Application error" rendered');
      if (dom.issues) {
        // Open the overlay to capture the first issue's title.
        const detail = await page
          .evaluate(async () => {
            const sr = document.querySelector('nextjs-portal')?.shadowRoot;
            sr?.querySelector('[data-issues-open]')?.click();
            await new Promise((r) => setTimeout(r, 1200));
            const d = sr?.querySelector('[data-nextjs-dialog]');
            return d ? d.innerText.replace(/\s+/g, ' ').trim().slice(0, 240) : '';
          })
          .catch(() => '');
        errs.push(`Next dev overlay issues badge: ${dom.issues}${detail ? ` - ${detail}` : ''}`);
      }
      if (dom.dialog) errs.push(`Next dev overlay open: ${dom.dialog}`);
      if (dom.visibleH1 !== 1) errs.push(`rendered h1 count (excluding display:none/aria-hidden) = ${dom.visibleH1}`);
    } catch (e) {
      errs.push(`navigation failed: ${String(e.message).split('\n')[0]}`);
    }
    await page.close();
    if (!opts.quiet) process.stderr.write(`[${viewer.name}] browser ${errs.length ? 'ISSUES' : 'ok'} ${p.url}\n`);
    for (const e of [...new Set(errs)]) findings.push({ url: p.url, route: p.route, problem: e });
  }
  await browser.close();
  return findings;
}

// ---------------------------------------------------------------- report
function group(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}
const rel = (u, base) => u.replace(base, '') || '/';
const uniq = (a) => [...new Set(a)];

function buildFindings(results, base) {
  const f = { badStatus: [], errorMarkers: [], h1: [], h1Responsive: [], emptyLinks: [], softNotFound: [], alerts: [], browser: [], flaky: [] };
  for (const r of results) {
    for (const p of r.pages) {
      if (p.flaky) f.flaky.push({ viewer: r.viewer, url: rel(p.url, base), route: p.route, first: `${p.flaky.status}${p.flaky.error ? ' ' + p.flaky.error : ''}${p.flaky.errors?.length ? ' ' + p.flaky.errors.join('; ') : ''}`, now: p.status });
      const refs = [...(r.referrers.get(p.url) || [])].map((u) => rel(u, base));
      if (![200, 307, 308].includes(p.status)) f.badStatus.push({ viewer: r.viewer, url: rel(p.url, base), route: p.route, status: p.status, error: p.error, location: p.location && rel(p.location, base), refs });
      const redirect = p.status >= 300 && p.status < 400;
      for (const e of redirect ? [] : p.errors || []) f.errorMarkers.push({ viewer: r.viewer, url: rel(p.url, base), route: p.route, status: p.status, kind: e });
      if (p.softNotFound && p.status === 200) f.softNotFound.push({ viewer: r.viewer, url: rel(p.url, base), route: p.route, refs });
      if (p.h1 && p.status === 200) {
        // Count per viewport width (Tailwind hidden / md:hidden / max-md:hidden resolved statically);
        // a page with one h1 per breakpoint (e.g. phone-only sr-only h1 + desktop h1) passes.
        const perWidth = WIDTHS.map((w) => [w, p.h1.filter((h) => (h.at ? h.at[w] !== false : true)).length]);
        const bad = perWidth.filter(([, n]) => n !== 1);
        if (bad.length || (!p.h1.length)) f.h1.push({ viewer: r.viewer, url: rel(p.url, base), route: p.route, count: p.h1.length, perWidth: Object.fromEntries(perWidth), h1: p.h1 });
        else if (p.h1.length > 1) f.h1Responsive.push({ viewer: r.viewer, url: rel(p.url, base), route: p.route, count: p.h1.length, perWidth: Object.fromEntries(perWidth), h1: p.h1 });
      }
      for (const l of p.emptyLinks || []) f.emptyLinks.push({ viewer: r.viewer, url: rel(p.url, base), ...l });
      for (const a of p.alerts || []) f.alerts.push({ viewer: r.viewer, url: rel(p.url, base), route: p.route, text: a });
    }
    for (const b of r.browser || []) f.browser.push({ viewer: r.viewer, ...b, url: rel(b.url, base) });
  }
  return f;
}

function printReport(results, f, base) {
  const L = [];
  L.push(`# crawl-links report for ${base}`);
  for (const r of results) {
    const st = group(r.pages, (p) => p.status).map(([s, a]) => `${s}x${a.length}`).join(' ');
    const routes = group(r.pages, (p) => p.route).map(([k, a]) => `${k} (${a.length})`).join(', ');
    L.push(`\n## viewer ${r.viewer}: ${r.pages.length} pages fetched${r.capped ? ` (CAP HIT, ${r.unvisited} queued URLs unvisited)` : ''}; statuses ${st}; ${r.skippedLinks} links into skipped paths`);
    L.push(`   routes: ${routes}`);
  }
  const section = (title, items, keyFn, fmt, n = 5) => {
    L.push(`\n## ${title}: ${items.length} occurrence(s)`);
    if (!items.length) return;
    for (const [k, arr] of group(items, keyFn)) {
      L.push(`- ${k}  [${arr.length}x; viewers: ${uniq(arr.map((x) => x.viewer)).join(', ')}; ${uniq(arr.map((x) => x.url)).length} page(s)]`);
      for (const ex of uniq(arr.map(fmt)).slice(0, n)) L.push(`    e.g. ${ex}`);
    }
  };
  section('Bad HTTP status (not 200/307/308)', f.badStatus, (x) => `${x.status}${x.error ? ' ' + x.error : ''} ${x.route}`, (x) => `${x.url}${x.location ? ' -> ' + x.location : ''}  (linked from ${x.refs.slice(0, 3).join(', ') || 'seed'}${x.refs.length > 3 ? ` +${x.refs.length - 3}` : ''})`);
  section('Error markers in HTML', f.errorMarkers, (x) => x.kind, (x) => `${x.url} [${x.status}]`);
  section('Soft 404 (200 + next-error not-found)', f.softNotFound, (x) => x.route, (x) => `${x.url}  (linked from ${x.refs.slice(0, 2).join(', ')})`);
  const h1fmt = (x) => `${x.url}  h1=${JSON.stringify(x.h1.map((h) => h.text + (h.css.length ? ` {${h.css.join(' ')}}` : '')))}`;
  const pw = (x) => Object.entries(x.perWidth).map(([w, n]) => `${n}@${w}px`).join(' ');
  section(`h1 count != 1 (in the HTML, or at a viewport width: ${WIDTHS.join('/')}px)`, f.h1, (x) => `${x.count} h1 in HTML (${pw(x)}) on ${x.route}`, h1fmt);
  section('Several h1 in HTML but one per breakpoint (responsive pair; info only)', f.h1Responsive, (x) => `${x.count} h1 in HTML (${pw(x)}) on ${x.route}`, h1fmt, 2);
  section('Links with empty accessible name', f.emptyLinks, (x) => x.snippet.replace(/href="[^"]*"/, `href="${x.href.replace(/\/[^/?#]*\d[^/?#]*|\/in\/[^/?#]+|\/programs\/[^/?#]+/g, (s) => s.split('/').slice(0, -1).join('/') + '/*')}"`), (x) => `${x.url} -> ${x.href}${x.css.length ? ` {${x.css.join(' ')}}` : ''}`, 3);
  section('Inline error/alert blocks (role=alert) on pages', f.alerts, (x) => `"${x.text}" on ${x.route}`, (x) => x.url, 3);
  section('Flaky (failed first, clean on re-fetch; not counted as findings)', f.flaky, (x) => `first ${x.first.slice(0, 120)} -> now ${x.now}`, (x) => x.url, 3);
  if (results.some((r) => r.browser)) section('Browser pass (client-side)', f.browser, (x) => `${x.problem} on ${x.route}`, (x) => x.url, 3);
  return L.join('\n');
}

// ---------------------------------------------------------------- main
const opts = parseArgs(process.argv.slice(2));
if (opts.widths) WIDTHS = opts.widths;
const appDir = opts.appDir ? resolve(opts.appDir) : [join(HERE, '../web/src/app'), join(HERE, '../web/app'), join(process.cwd(), 'src/app'), join(process.cwd(), 'app')].find((d) => existsSync(d));
const patterns = loadRoutePatterns(appDir);
const results = [];
if (opts.fromJson) {
  // Re-report (and optionally re-run the browser pass) from a previous --json run without re-crawling.
  const prev = JSON.parse(readFileSync(opts.fromJson, 'utf8'));
  for (const pv of prev.viewers) {
    const v = opts.viewers.find((x) => x.name === pv.viewer) || { name: pv.viewer, cookie: null };
    const r = { viewer: pv.viewer, capped: pv.capped, unvisited: pv.unvisited, skippedLinks: pv.skippedLinks, pages: pv.pages, referrers: new Map(pv.pages.map((p) => [p.url, new Set(p.referrers || [])])), browser: pv.browser };
    if (opts.browser > 0) r.browser = await browserPass(v, r, opts, opts.browser);
    results.push(r);
  }
} else {
  for (const v of opts.viewers) {
    const r = await crawlViewer(v, opts, patterns);
    if (opts.browser > 0) r.browser = await browserPass(v, r, opts, opts.browser);
    results.push(r);
  }
}
const base = opts.base.replace(/\/$/, '');
const findings = buildFindings(results, base);
console.log(printReport(results, findings, base));
if (opts.json) {
  mkdirSync(dirname(resolve(opts.json)), { recursive: true });
  writeFileSync(
    opts.json,
    JSON.stringify(
      {
        base,
        at: new Date().toISOString(),
        options: { ...opts, viewers: opts.viewers.map((v) => v.name) },
        viewers: results.map((r) => ({ viewer: r.viewer, capped: r.capped, unvisited: r.unvisited, skippedLinks: r.skippedLinks, pages: r.pages.map((p) => ({ ...p, referrers: [...(r.referrers.get(p.url) || [])].slice(0, 20) })), browser: r.browser })),
        findings,
      },
      null,
      1,
    ),
  );
  console.log(`\njson written to ${opts.json}`);
}
const total = findings.badStatus.length + findings.errorMarkers.length + findings.h1.length + findings.emptyLinks.length + findings.softNotFound.length + findings.browser.length;
process.exit(total ? 1 : 0);
