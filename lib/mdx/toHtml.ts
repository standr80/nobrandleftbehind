import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

/** Strip YAML frontmatter block (--- ... ---) from body_mdx before converting */
function stripFrontmatter(mdx: string): string {
  return mdx.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
}

/**
 * Repair Windows-1252 UTF-8 mojibake using targeted pattern replacement.
 *
 * This happens when UTF-8 multi-byte sequences are stored/decoded as Windows-1252
 * characters, e.g. the em dash — (bytes E2 80 94) becomes â€" because:
 *   byte E2 → â (U+00E2, Latin-1)
 *   byte 80 → € (U+20AC, W1252 special)
 *   byte 94 → " (U+201D, W1252 special — right double quote)
 *
 * Each entry below is the exact Unicode sequence produced by that misreading,
 * mapped back to the correct character. Unaffected text is left untouched.
 */
export function repairMojibake(str: string): string {
  return str
    // ── Typographic dashes ──────────────────────────────────────────────────
    // em dash — [E2 80 94]:  â + € + " (U+201D right double quote)
    .replace(/\u00E2\u20AC\u201D/g, '\u2014')
    // en dash – [E2 80 93]:  â + € + " (U+201C left double quote)
    .replace(/\u00E2\u20AC\u201C/g, '\u2013')
    // ── Smart quotes ────────────────────────────────────────────────────────
    // left single quote ' [E2 80 98]:  â + € + ˜ (U+02DC small tilde)
    .replace(/\u00E2\u20AC\u02DC/g, '\u2018')
    // right single quote / apostrophe ' [E2 80 99]:  â + € + ™ (U+2122 trademark)
    .replace(/\u00E2\u20AC\u2122/g, '\u2019')
    // left double quote " [E2 80 9C]:  â + € + œ (U+0153)
    .replace(/\u00E2\u20AC\u0153/g, '\u201C')
    // right double quote " [E2 80 9D]:  â + € + (U+009D control char)
    .replace(/\u00E2\u20AC\u009D/g, '\u201D')
    // ── Other common typographic chars ──────────────────────────────────────
    // ellipsis … [E2 80 A6]:  â + € + ¦ (U+00A6 broken bar)
    .replace(/\u00E2\u20AC\u00A6/g, '\u2026')
    // bullet • [E2 80 A2]:  â + € + ¢ (U+00A2 cent sign)
    .replace(/\u00E2\u20AC\u00A2/g, '\u2022')
    // trade mark ™ [E2 84 A2]: â + „ (U+2122) — already valid; skip
    // ── Accented Latin letters (C3 xx sequences) ────────────────────────────
    // é [C3 A9]:  Ã + © (U+00A9)
    .replace(/\u00C3\u00A9/g, '\u00E9')
    // è [C3 A8]:  Ã + ¨ (U+00A8)
    .replace(/\u00C3\u00A8/g, '\u00E8')
    // ê [C3 AA]:  Ã + ª (U+00AA)
    .replace(/\u00C3\u00AA/g, '\u00EA')
    // ë [C3 AB]:  Ã + « (U+00AB)
    .replace(/\u00C3\u00AB/g, '\u00EB')
    // à [C3 A0]:  Ã + (U+00A0 non-breaking space)
    .replace(/\u00C3\u00A0/g, '\u00E0')
    // á [C3 A1]:  Ã + ¡ (U+00A1)
    .replace(/\u00C3\u00A1/g, '\u00E1')
    // â [C3 A2]:  Ã + ¢ (U+00A2) — careful: only inside Ã-prefixed pairs
    .replace(/\u00C3\u00A2/g, '\u00E2')
    // ä [C3 A4]:  Ã + ¤ (U+00A4)
    .replace(/\u00C3\u00A4/g, '\u00E4')
    // ç [C3 A7]:  Ã + § (U+00A7)
    .replace(/\u00C3\u00A7/g, '\u00E7')
    // í [C3 AD]:  Ã + ­ (U+00AD soft hyphen)
    .replace(/\u00C3\u00AD/g, '\u00ED')
    // î [C3 AE]:  Ã + ® (U+00AE)
    .replace(/\u00C3\u00AE/g, '\u00EE')
    // ñ [C3 B1]:  Ã + ± (U+00B1)
    .replace(/\u00C3\u00B1/g, '\u00F1')
    // ó [C3 B3]:  Ã + ³ (U+00B3)
    .replace(/\u00C3\u00B3/g, '\u00F3')
    // ô [C3 B4]:  Ã + ´ (U+00B4)
    .replace(/\u00C3\u00B4/g, '\u00F4')
    // ö [C3 B6]:  Ã + ¶ (U+00B6)
    .replace(/\u00C3\u00B6/g, '\u00F6')
    // ú [C3 BA]:  Ã + º (U+00BA)
    .replace(/\u00C3\u00BA/g, '\u00FA')
    // ü [C3 BC]:  Ã + ¼ (U+00BC)
    .replace(/\u00C3\u00BC/g, '\u00FC')
    // ── C2 xx sequences (non-breaking space prefix) ─────────────────────────
    // £ [C2 A3]:  Â + £ (U+00A3) — wait, Â = U+00C2 but here the Â is the mojibake char
    .replace(/\u00C2\u00A3/g, '\u00A3')  // £
    .replace(/\u00C2\u00A9/g, '\u00A9')  // ©
    .replace(/\u00C2\u00AE/g, '\u00AE')  // ®
    .replace(/\u00C2\u00B0/g, '\u00B0')  // °
    .replace(/\u00C2\u00B1/g, '\u00B1')  // ±
    .replace(/\u00C2\u00B2/g, '\u00B2')  // ²
    .replace(/\u00C2\u00B3/g, '\u00B3')  // ³
    .replace(/\u00C2\u00BD/g, '\u00BD')  // ½
    .replace(/\u00C2\u00A0/g, '\u00A0')  // non-breaking space (keeps semantics)
}

/** Convert body_mdx (with optional YAML frontmatter) to an HTML string */
export async function toHtml(mdx: string): Promise<string> {
  const body = repairMojibake(stripFrontmatter(mdx))
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(body)
  return String(file)
}

interface WrapOptions {
  heroImageUrl?: string
  heroImageAlt?: string
}

/**
 * Wrap converted HTML in a minimal self-contained HTML document.
 * No class names, no external CSS — safe to paste into emails or basic HTML pages.
 */
export function wrapInDocument(title: string, bodyHtml: string, opts: WrapOptions = {}): string {
  const heroBlock = opts.heroImageUrl
    ? `<img src="${opts.heroImageUrl}" alt="${escapeHtml(opts.heroImageAlt ?? title)}" style="width:100%;max-height:400px;object-fit:cover;border-radius:6px;display:block;margin:0 0 1.5em;" />`
    : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; }
  h1,h2,h3,h4 { font-family: system-ui, sans-serif; line-height: 1.3; margin: 1.5em 0 0.5em; }
  h1 { font-size: 2em; }
  h2 { font-size: 1.4em; }
  h3 { font-size: 1.15em; }
  p { margin: 0 0 1em; }
  a { color: #2563eb; }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  pre { background: #f4f4f5; border-radius: 4px; padding: 1em; overflow-x: auto; font-size: 0.875em; }
  code { background: #f4f4f5; padding: 0.15em 0.35em; border-radius: 3px; font-size: 0.875em; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #d1d5db; margin: 1.5em 0; padding: 0.5em 1em; color: #6b7280; }
  ul,ol { margin: 0 0 1em; padding-left: 1.5em; }
  li { margin-bottom: 0.25em; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
</style>
</head>
<body>
${heroBlock}<h1 style="font-size:2em;font-family:system-ui,sans-serif;line-height:1.3;margin:0 0 0.5em;">${escapeHtml(title)}</h1>
${bodyHtml}
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
