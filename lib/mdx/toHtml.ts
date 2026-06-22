import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import { repairMojibake } from './repairMojibake'

export { repairMojibake } from './repairMojibake'

/**
 * Strip a code fence wrapping the ENTIRE document (```mdx … ```).
 * LLMs sometimes wrap their whole reply in a fence despite instructions;
 * without this the post renders as one giant code block.
 * Fences inside the body (actual code samples) are untouched.
 */
export function stripWrappingFence(mdx: string): string {
  const trimmed = mdx.trim()
  const match = trimmed.match(/^```[\w-]*[ \t]*\r?\n([\s\S]*?)\r?\n?```\s*$/)
  return match ? match[1].trim() : trimmed
}

/** Strip YAML frontmatter block (--- ... ---) from body_mdx before converting */
function stripFrontmatter(mdx: string): string {
  return mdx.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
}

/**
 * Convert Tailwind alignment/layout classes on <img> tags to equivalent inline
 * CSS.  The editor stores alignment as class="… float-right …" (Tailwind) and
 * size as style="width:XX%…".  In exported HTML there is no Tailwind stylesheet,
 * so we translate the classes to inline styles that work anywhere.
 */
function inlineTailwindAlignment(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const classMatch = attrs.match(/\bclass="([^"]*)"/i)
    if (!classMatch) return full

    const classes = new Set(classMatch[1].split(/\s+/).filter(Boolean))
    const extra: string[] = []

    if (classes.has('float-right')) {
      extra.push('float:right', 'margin:1rem 0 1rem 1.5rem')
    } else if (classes.has('float-left')) {
      extra.push('float:left', 'margin:1rem 1.5rem 1rem 0')
    } else if (classes.has('w-full')) {
      extra.push('display:block', 'width:100%', 'margin:1rem 0')
    } else {
      extra.push('display:block', 'margin:1rem auto')
    }
    if (classes.has('rounded-lg')) extra.push('border-radius:0.5rem')
    if (classes.has('max-w-full')) extra.push('max-width:100%')

    // Merge with any existing inline style (e.g. the size set by the editor)
    const styleMatch = attrs.match(/\bstyle="([^"]*)"/i)
    const existing = styleMatch ? styleMatch[1].replace(/;\s*$/, '') : ''
    const merged = [existing, ...extra].filter(Boolean).join(';')

    // Strip class + old style, keep everything else (src, alt, etc.)
    const cleanAttrs = attrs
      .replace(/\s*\bclass="[^"]*"/gi, '')
      .replace(/\s*\bstyle="[^"]*"/gi, '')
      .trim()

    return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} style="${merged}">`
  })
}

/**
 * Inline link styling onto every <a> in the body, so links are clearly
 * highlighted wherever the exported HTML is rendered — including consumer sites
 * whose own CSS strips link colour/underline (inline styles win over a host
 * stylesheet). Always underlines; applies `linkColor` when given (the tenant's
 * brand colour) so links stay on-brand. Existing attributes are preserved and
 * any existing inline style is merged, with our declarations taking precedence.
 */
function inlineLinkStyles(html: string, linkColor?: string): string {
  const decls = [...(linkColor ? [`color:${linkColor}`] : []), 'text-decoration:underline']
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs) => {
    const styleMatch = attrs.match(/\bstyle="([^"]*)"/i)
    const existing = styleMatch ? styleMatch[1].replace(/;\s*$/, '') : ''
    const merged = [existing, ...decls].filter(Boolean).join(';')
    const cleanAttrs = attrs.replace(/\s*\bstyle="[^"]*"/gi, '').trim()
    return `<a${cleanAttrs ? ' ' + cleanAttrs : ''} style="${merged}">`
  })
}

interface ToHtmlOptions {
  /** Brand colour applied inline to links. Falls back to underline-only. */
  linkColor?: string
}

/** Convert body_mdx (with optional YAML frontmatter) to an HTML string */
export async function toHtml(mdx: string, opts: ToHtmlOptions = {}): Promise<string> {
  const body = repairMojibake(stripFrontmatter(stripWrappingFence(mdx)))
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(body)
  return inlineLinkStyles(inlineTailwindAlignment(String(file)), opts.linkColor)
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
  a { color: #2563eb; text-decoration: underline; }
  img { max-width: 100%; height: auto; border-radius: 4px; }
  pre { background: #f4f4f5; border-radius: 4px; padding: 1em; overflow-x: auto; font-size: 0.875em; }
  code { background: #f4f4f5; padding: 0.15em 0.35em; border-radius: 3px; font-size: 0.875em; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #d1d5db; margin: 1.5em 0; padding: 0.5em 1em; color: #6b7280; }
  ul,ol { margin: 0 0 1em; padding-left: 1.5em; }
  li { margin-bottom: 0.25em; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  mark { background: #fef08a; padding: 0.1em 0.2em; border-radius: 2px; }
  u { text-decoration: underline; }
  table { border-collapse: collapse; width: 100%; margin: 1.5em 0; font-size: 0.9em; }
  th, td { border: 1px solid #d1d5db; padding: 0.5em 0.75em; text-align: left; }
  th { background: #f9fafb; font-weight: 600; }
  tr:nth-child(even) td { background: #f9fafb; }
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
