/**
 * Decodes HTML character references (e.g. &#039; &apos; &amp; &ldquo;) for plain-text display.
 * Iterates until stable so values like `Tom&amp;#039;s` become `Tom's`.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  quot: "\"",
  nbsp: "\u00A0",
  copy: "\u00A9",
  reg: "\u00AE",
  trade: "\u2122",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  pound: "\u00A3",
  euro: "\u20AC",
  yen: "\u00A5",
  cent: "\u00A2",
  deg: "\u00B0",
  frac12: "\u00BD",
  frac14: "\u00BC",
  frac34: "\u00BE",
};

function decodePass(s: string): string {
  let out = s.replace(/&([a-z][a-z0-9]*);/gi, (full, name: string) => {
    const key = name.toLowerCase();
    return NAMED_ENTITIES[key] ?? full;
  });
  out = out.replace(/&#x([0-9a-fA-F]{1,6});/gi, (full, hex: string) => {
    const n = parseInt(hex, 16);
    if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return full;
    try {
      return String.fromCodePoint(n);
    } catch {
      return full;
    }
  });
  out = out.replace(/&#(\d{1,7});/g, (full, dec: string) => {
    const n = parseInt(dec, 10);
    if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return full;
    try {
      return String.fromCodePoint(n);
    } catch {
      return full;
    }
  });
  return out;
}

export function decodeHtmlEntities(input: string | null | undefined): string {
  if (input == null) return "";
  let s = String(input);
  for (let i = 0; i < 8; i++) {
    const next = decodePass(s);
    if (next === s) break;
    s = next;
  }
  return s;
}
