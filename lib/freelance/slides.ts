// Turns a notes document (a .docx read by mammoth, or its plain text) into
// slides: one per lesson, commentary, review or breakdown, grouped by chapter.
// The words are kept exactly as written; only bullets and spacing are tidied.

export type Block = { type: 'p' | 'li' | 'h'; text: string } | { type: 'img'; src: string };
export type Slide = { section: string | null; title: string; body: string };

const CHAPTER = /^chapter\s*(\d+)\b\s*[-–:]?\s*(.*)$/i;
const SLIDE_START =
  /^(lesson\s*\d+|weekly\s*comm?(entary)?\.?\s*\d+|weekly\s*com\s*\d+|zoom\s*\d+|element\s+(one|two|three|four|five|six)\b|[a-z]{6}\s+trade\s+review|trade\s+breakdowns?|charting\s+for\s+chapter|.*\(self-ratings\))/i;

const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+$/g, '').replace(/^\s+/g, '');
/** "Lesson 1- Intro to price algo" -> "Lesson 1 - Intro to price algo"; drops a trailing dash. */
export function tidyTitle(s: string): string {
  return clean(s)
    .replace(/\s*[-–]\s*$/, '')
    .replace(/^weekly\s*comm?(entary)?\.?\s*(\d+)/i, 'Weekly Commentary $2')
    .replace(/^(.*?(\d+|element\s+\w+))\s*[-–]\s*/i, '$1 - ')
    .replace(/\s{2,}/g, ' ');
}

export function textToBlocks(text: string): Block[] {
  return text
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean)
    .map<Block>((line) => (/^[•●▪◦\-*]\s+/.test(line) ? { type: 'li', text: line.replace(/^[•●▪◦\-*]\s+/, '') } : { type: 'p', text: line }));
}

/** Minimal reader for mammoth's HTML: headings, paragraphs, list items and images, in order. */
export function htmlToBlocks(html: string): Block[] {
  const out: Block[] = [];
  const re = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*src="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[3]) {
      out.push({ type: 'img', src: m[3] });
      continue;
    }
    const inner = m[2];
    for (const img of inner.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*>/gi)) out.push({ type: 'img', src: img[1] });
    const text = decode(inner.replace(/<br\s*\/?>/gi, ' ').replace(/<\/?(strong|b)>/gi, '**').replace(/<[^>]+>/g, ''))
      .replace(/\*\*\s*\*\*/g, '')
      .trim();
    if (!text) continue;
    const tag = m[1].toLowerCase();
    out.push({ type: tag.startsWith('h') ? 'h' : tag === 'li' ? 'li' : 'p', text });
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function blocksToSlides(blocks: Block[]): Slide[] {
  const slides: Slide[] = [];
  let section: string | null = null;
  let current: { title: string; lines: string[] } | null = null;
  const intro: string[] = [];

  const flush = () => {
    if (current) slides.push({ section, title: current.title, body: render(current.lines) });
    current = null;
  };

  for (const b of blocks) {
    if (b.type === 'img') {
      (current?.lines ?? intro).push(`![](${b.src})`);
      continue;
    }
    const text = b.text.replace(/\*\*/g, '');
    const ch = text.match(CHAPTER);
    if (ch && !/self-ratings/i.test(text)) {
      flush();
      section = `Chapter ${ch[1]}`;
      // "Chapter 6- OHLC & OLHC" is a chapter and its own first slide.
      if (ch[2].trim()) current = { title: tidyTitle(ch[2]), lines: [] };
      continue;
    }
    // A chapter's self-ratings list lessons by name; those lines belong to the ratings slide.
    const inRatings = current !== null && /self-ratings/i.test(current.title) && /^lesson\s*\d+/i.test(text);
    if (!inRatings && (SLIDE_START.test(text) || (b.type === 'h' && text.length < 90))) {
      flush();
      current = { title: tidyTitle(text.replace(/[()]/g, '').replace(/\s*-\s*self-ratings/i, ' self-ratings')), lines: [] };
      continue;
    }
    (current?.lines ?? intro).push(b.type === 'li' ? `- ${b.text}` : b.text);
  }
  flush();

  // Anything before the first heading (the document's title page) becomes a cover slide.
  if (intro.length) slides.unshift({ section: null, title: intro[0].replace(/\*\*/g, ''), body: render(intro.slice(1)) });
  return slides;
}

/** Bullets stay together as a list; every other line is its own paragraph. */
function render(lines: string[]): string {
  const out: string[] = [];
  for (const l of lines) {
    const isLi = l.startsWith('- ');
    const prevLi = out.length > 0 && out[out.length - 1].startsWith('- ');
    if (isLi && prevLi) out[out.length - 1] += `\n${l}`;
    else out.push(l);
  }
  return out.join('\n\n');
}

export const docTextToSlides = (text: string) => blocksToSlides(textToBlocks(text));
export const docHtmlToSlides = (html: string) => blocksToSlides(htmlToBlocks(html));
