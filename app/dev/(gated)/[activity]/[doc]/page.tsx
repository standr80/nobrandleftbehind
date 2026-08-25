import fs from 'node:fs/promises'
import path from 'node:path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DEV_ACTIVITIES, docHref, getActivity, getDoc } from '@/lib/dev/manifest'
import { renderMarkdown } from '@/lib/dev/markdown'

/**
 * Renders a Markdown document from public/dev-docs/ as a styled page.
 *
 * Statically generated: the file read happens at build time, so no filesystem
 * access is needed at request time on Vercel. Access is still gated — the
 * middleware runs on requests for static pages too.
 */
export const dynamic = 'force-static'

export function generateStaticParams() {
  return DEV_ACTIVITIES.flatMap((activity) =>
    activity.docs
      .filter((doc) => doc.kind === 'md')
      .map((doc) => ({ activity: activity.slug, doc: doc.slug })),
  )
}

export default async function DevDocPage({
  params,
}: {
  params: Promise<{ activity: string; doc: string }>
}) {
  const { activity: activitySlug, doc: docSlug } = await params

  const activity = getActivity(activitySlug)
  const doc = getDoc(activitySlug, docSlug)
  if (!activity || !doc || doc.kind !== 'md') notFound()

  const filePath = path.join(process.cwd(), 'public', 'dev-docs', activitySlug, doc.file)

  let markdown: string
  try {
    markdown = await fs.readFile(filePath, 'utf8')
  } catch {
    notFound()
  }

  const html = await renderMarkdown(markdown)

  return (
    <article>
      <nav className="mb-6 text-xs text-slate-400">
        <Link href="/dev" className="transition hover:text-slate-700">
          R&amp;D
        </Link>
        <span className="mx-1.5">/</span>
        <span>{activity.title}</span>
      </nav>

      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {doc.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              {doc.summary}
            </p>
          </div>
          <a
            href={docHref(activitySlug, doc)}
            download
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            Download .md
          </a>
        </div>
      </header>

      <div
        className="prose prose-slate max-w-none prose-headings:tracking-tight prose-h1:text-2xl prose-h2:mt-10 prose-h2:border-t prose-h2:border-slate-200 prose-h2:pt-6 prose-h2:text-xl prose-h3:text-base prose-p:text-slate-700 prose-a:text-slate-900 prose-table:text-sm prose-th:text-left prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  )
}
