/*
 * Text widths for the tree diagram's server-side layout (Inter, as the app loads it). Advance widths
 * in em, measured in Chromium with getComputedTextLength() on 20-character runs at 12px (they scale
 * linearly: the optical-size axis gives the same advances at 14px). Kerning is ignored (a pixel or two
 * per label), so fits are judged with a small allowance. The client re-measures the dotted marks.
 */

const CHARS = "0123456789!\"#$%&'()*+,-./:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~–·…’‘éáíóñüÉ";
const W400 = [
  631, 407, 610, 618, 646, 593, 620, 585, 619, 620, 288, 466, 633, 642, 982, 644, 300, 365, 365, 501, 662, 288, 460, 288, 360, 288, 302, 662, 662, 662, 511, 966, 704,
  654, 730, 722, 601, 590, 746, 743, 269, 571, 672, 565, 903, 753, 765, 639, 765, 644, 642, 646, 744, 704, 1009, 682, 679, 629, 365, 314, 365, 471, 456, 323, 562, 612,
  571, 612, 583, 333, 613, 591, 242, 242, 549, 242, 876, 591, 600, 612, 612, 391, 528, 327, 591, 562, 818, 546, 562, 552, 426, 333, 426, 662, 500, 288, 864, 261, 261,
  583, 562, 242, 600, 591, 591, 601,
];
const W600 = [
  660, 423, 623, 636, 666, 612, 640, 595, 640, 640, 321, 523, 644, 650, 1004, 663, 326, 373, 373, 540, 673, 319, 465, 319, 379, 319, 329, 673, 673, 673, 543, 999, 741,
  659, 737, 722, 605, 588, 749, 746, 277, 580, 703, 565, 922, 759, 769, 645, 773, 652, 650, 660, 736, 741, 1042, 720, 713, 652, 373, 333, 373, 481, 469, 351, 574, 624,
  583, 624, 591, 350, 626, 612, 262, 262, 569, 262, 900, 612, 609, 624, 624, 407, 549, 346, 612, 587, 839, 569, 588, 566, 455, 359, 455, 673, 500, 319, 956, 294, 294,
  591, 574, 262, 609, 612, 612, 605,
];

const TABLE = new Map<string, [number, number]>([...CHARS].map((ch, i) => [ch, [W400[i] / 1000, W600[i] / 1000]]));
const SPACE: Record<Weight, number> = { 400: 0.283, 500: 0.267, 600: 0.25 };
/** Tabular figures (the `num` utility): every digit 0.648em; comma and period narrow. */
const TABULAR: Record<string, number> = { ",": 0.269, ".": 0.269 };

export type Weight = 400 | 500 | 600;

/** Rendered width in px of `text` at `size` px; `tabular` for text in the `num` utility (ranges, counts). */
export function textWidth(text: string, size: number, weight: Weight = 400, tabular = false): number {
  let em = 0;
  for (const ch of text) {
    if (ch === " ") {
      em += SPACE[weight];
      continue;
    }
    if (tabular && ch >= "0" && ch <= "9") {
      em += 0.648;
      continue;
    }
    if (tabular && TABULAR[ch] !== undefined) {
      em += TABULAR[ch];
      continue;
    }
    const w = TABLE.get(ch);
    if (!w) em += weight === 600 ? 0.62 : 0.6;
    else em += weight === 400 ? w[0] : weight === 600 ? w[1] : (w[0] + w[1]) / 2;
  }
  return em * size;
}

/** `text` cut with an ellipsis to fit `maxW` (only for titles and program names; never a person's name or a year). */
export function truncate(text: string, maxW: number, size: number, weight: Weight = 400): string {
  if (textWidth(text, size, weight) <= maxW) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t.trimEnd()}…`, size, weight) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/**
 * A person's name in at most two lines, centred under the node: unchanged when it fits; otherwise split
 * at the space (or, failing that, after a hyphen) that makes the longer line shortest. Only a single
 * word wider than the label is cut, which no name in the data comes close to.
 */
export function wrapName(name: string, maxW: number, size: number, weight: Weight = 600): string[] {
  if (textWidth(name, size, weight) <= maxW) return [name];
  const splits: { a: string; b: string; cost: number }[] = [];
  for (let i = 1; i < name.length - 1; i++) {
    const hyphen = name[i] === "-";
    if (name[i] !== " " && !hyphen) continue;
    const a = hyphen ? name.slice(0, i + 1) : name.slice(0, i);
    const b = name.slice(i + 1);
    const wa = textWidth(a, size, weight);
    const wb = textWidth(b, size, weight);
    if (wa <= maxW && wb <= maxW) splits.push({ a, b, cost: Math.max(wa, wb) + (hyphen ? 24 : 0) });
  }
  if (splits.length) {
    const best = splits.reduce((x, y) => (y.cost < x.cost ? y : x));
    return [best.a, best.b];
  }
  const words = name.split(" ");
  let first = words[0];
  for (let i = 1; i < words.length && textWidth(`${first} ${words[i]}`, size, weight) <= maxW; i++) first = `${first} ${words[i]}`;
  const rest = name.slice(first.length).trim();
  return rest ? [truncate(first, maxW, size, weight), truncate(rest, maxW, size, weight)] : [truncate(first, maxW, size, weight)];
}
