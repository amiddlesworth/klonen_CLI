/*
 * A tiny, safe reader for job descriptions written in "markdown-ish" text: paragraphs, a line that
 * is only **Bold** starts a section, lines starting with "- " are bullets, **bold** inline, and a
 * paragraph wrapped in _underscores_ is a note. It produces plain data; React renders it as text,
 * so no HTML in a description is ever interpreted.
 */

export type Inline = { text: string; bold: boolean };
export type Block = { kind: "p"; inlines: Inline[] } | { kind: "ul"; items: Inline[][] } | { kind: "note"; inlines: Inline[] };
export type DescriptionSection = { heading: string | null; blocks: Block[] };

const HEADING = /^\*\*([^*]{1,80}?)\*\*:?$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NOTE = /^_(.+)_$/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  // Emphasis with underscores renders as plain text (the design uses no italics).
  return out.map((i) => ({ ...i, text: i.text.replace(/(^|\s)_([^_]+)_(?=\s|[.,;:!?]|$)/g, "$1$2") })).filter((i) => i.text);
}

export function parseDescription(src: string): DescriptionSection[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const sections: DescriptionSection[] = [{ heading: null, blocks: [] }];
  let para: string[] = [];
  let bullets: string[] = [];
  const cur = () => sections[sections.length - 1];
  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ").trim();
    para = [];
    if (!text) return;
    const note = NOTE.exec(text);
    cur().blocks.push(note ? { kind: "note", inlines: parseInline(note[1]) } : { kind: "p", inlines: parseInline(text) });
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    cur().blocks.push({ kind: "ul", items: bullets.map(parseInline) });
    bullets = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushBullets();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flushPara();
      flushBullets();
      sections.push({ heading: h[1].trim(), blocks: [] });
      continue;
    }
    const b = BULLET.exec(raw);
    if (b) {
      flushPara();
      bullets.push(b[1].trim());
      continue;
    }
    flushBullets();
    para.push(line);
  }
  flushPara();
  flushBullets();
  return sections.filter((s) => s.blocks.length > 0);
}

/** First paragraph as plain text, for meta descriptions. */
export function descriptionSummary(src: string, max = 180): string {
  const first = parseDescription(src)
    .flatMap((s) => s.blocks)
    .find((b) => b.kind === "p");
  const text = first && first.kind === "p" ? first.inlines.map((i) => i.text).join("") : "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
