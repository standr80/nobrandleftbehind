import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

/**
 * Plain Markdown -> HTML for the /dev document viewer.
 *
 * Deliberately separate from `lib/mdx/toHtml`, which carries blog-specific
 * behaviour (inline link colours, Tailwind alignment translation for the
 * editor's images). Coupling the two would mean a change made for blog
 * rendering could silently alter these documents, and vice versa.
 *
 * Raw HTML in the source is NOT passed through — these documents are ours,
 * but rendering them without `rehype-raw` keeps the viewer inert either way.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown)

  return String(file)
}
