import Link from 'next/link'
import { DEV_ACTIVITIES, docHref, viewHref, type DocKind } from '@/lib/dev/manifest'

const KIND_LABEL: Record<DocKind, string> = {
  md: 'Document',
  html: 'Web page',
  pdf: 'PDF',
}

export default function DevIndexPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Research &amp; development
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Working documents for projects in progress. These are drafts, not decisions —
          expect them to change.
        </p>
      </div>

      {DEV_ACTIVITIES.map((activity) => (
        <section key={activity.slug} className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {activity.title}
              </h2>
              <span className="text-xs text-slate-400">Updated {activity.updated}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              {activity.summary}
            </p>
          </div>

          <ul className="divide-y divide-slate-100">
            {activity.docs.map((doc) => (
              <li
                key={doc.slug}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-slate-900">{doc.title}</h3>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {KIND_LABEL[doc.kind]}
                    </span>
                  </div>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
                    {doc.summary}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {doc.kind === 'md' ? (
                    <Link
                      href={viewHref(activity.slug, doc)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                    >
                      View
                    </Link>
                  ) : (
                    <a
                      href={viewHref(activity.slug, doc)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                    >
                      View
                    </a>
                  )}
                  <a
                    href={docHref(activity.slug, doc)}
                    download
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                  >
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
