import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

/** Strip YAML frontmatter block (--- ... ---) from body_mdx before converting */
function stripFrontmatter(mdx: string): string {
  return mdx.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
}

/** Convert body_mdx (with optional YAML frontmatter) to an HTML string */
export async function toHtml(mdx: string): Promise<string> {
  const body = stripFrontmatter(mdx)
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
