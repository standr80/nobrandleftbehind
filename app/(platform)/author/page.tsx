import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  in_review: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-50 text-green-700',
  scheduled: 'bg-purple-50 text-purple-700',
  pr_open: 'bg-indigo-50 text-indigo-700',
  published: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
}

const STATUSES = ['all', 'in_review', 'draft', 'approved', 'scheduled', 'pr_open', 'published', 'rejected']
const TYPES = ['all', 'blog', 'faq']
const SORTS: Record<string, string> = {
  updated: 'updated_at',
  published: 'published_at',
  title: 'title',
  status: 'status',
  type: 'content_type',
}
const PER_PAGE = 20

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

interface SP {
  page?: string
  status?: string
  type?: string
  sort?: string
  dir?: string
  q?: string
}

export default async function EditorPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { userId } = await auth()
  if (!userId) return null

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) {
    return (
      <div className="max-w-6xl">
        <h1 className="text-2xl font-bold mb-8">Editor</h1>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm">No workspace linked to your account.</p>
        </div>
      </div>
    )
  }

  const sp = await searchParams
  const status = typeof sp.status === 'string' && STATUSES.includes(sp.status) ? sp.status : 'all'
  const type = typeof sp.type === 'string' && TYPES.includes(sp.type) ? sp.type : 'all'
  const sort = typeof sp.sort === 'string' && sp.sort in SORTS ? sp.sort : 'updated'
  const dir: 'asc' | 'desc' = sp.dir === 'asc' ? 'asc' : 'desc'
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const page = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1)
  const from = (page - 1) * PER_PAGE

  const db = createAdminClient()
  let query = db
    .from('blog_posts')
    .select('id, title, slug, status, content_type, updated_at, published_at', { count: 'exact' })
    .eq('tenant_id', workspace.tenantId)
  if (status !== 'all') query = query.eq('status', status)
  if (type !== 'all') query = query.eq('content_type', type)
  if (q) query = query.ilike('title', `%${q}%`)
  query = query.order(SORTS[sort], { ascending: dir === 'asc', nullsFirst: false }).range(from, from + PER_PAGE - 1)

  const { data: posts, count } = await query
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const hasFilters = status !== 'all' || type !== 'all' || !!q

  // Build a /author URL from the current params with overrides (omitting defaults).
  const buildHref = (ov: Partial<SP>): string => {
    const m = { status, type, sort, dir, q, page: String(page), ...ov }
    const p = new URLSearchParams()
    if (m.status && m.status !== 'all') p.set('status', m.status)
    if (m.type && m.type !== 'all') p.set('type', m.type)
    if (m.sort && m.sort !== 'updated') p.set('sort', m.sort)
    if (m.dir && m.dir !== 'desc') p.set('dir', m.dir)
    if (m.q) p.set('q', m.q)
    if (m.page && m.page !== '1') p.set('page', m.page)
    const qs = p.toString()
    return qs ? `/author?${qs}` : '/author'
  }

  const SortHeader = ({ col, label, className = '' }: { col: string; label: string; className?: string }) => {
    const active = sort === col
    const nextDir = active ? (dir === 'asc' ? 'desc' : 'asc') : col === 'title' ? 'asc' : 'desc'
    return (
      <th className={`px-4 py-2.5 text-left text-xs font-semibold text-slate-500 ${className}`}>
        <Link href={buildHref({ sort: col, dir: nextDir, page: '1' })} className="inline-flex items-center gap-1 hover:text-slate-900">
          {label}
          <span className="text-slate-400">{active ? (dir === 'asc' ? '↑' : '↓') : ''}</span>
        </Link>
      </th>
    )
  }

  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
      active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
    }`

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Clem</span>
          <span className="text-xs text-slate-400">{workspace.tenant.name} · {workspace.tenant.domain}</span>
        </div>
        <h1 className="text-2xl font-bold">Editor</h1>
        <p className="text-sm text-slate-400 mt-1">{total} {type === 'faq' ? 'FAQ page' : 'post'}{total !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {STATUSES.map((s) => (
          <Link key={s} href={buildHref({ status: s, page: '1' })} className={chip(status === s)}>
            {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {TYPES.map((t) => (
            <Link key={t} href={buildHref({ type: t, page: '1' })} className={chip(type === t)}>
              {t === 'all' ? 'All types' : t === 'faq' ? 'FAQ' : 'Blog'}
            </Link>
          ))}
        </div>
        <form action="/author" method="get" className="flex items-center gap-2">
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          {type !== 'all' && <input type="hidden" name="type" value={type} />}
          {sort !== 'updated' && <input type="hidden" name="sort" value={sort} />}
          {dir !== 'desc' && <input type="hidden" name="dir" value={dir} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search titles…"
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 w-48"
          />
          <button type="submit" className="text-sm font-medium px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700">
            Search
          </button>
          {q && (
            <Link href={buildHref({ q: '', page: '1' })} className="text-xs text-slate-400 hover:text-slate-700">
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Table */}
      {total === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          {hasFilters ? (
            <>
              <p className="text-slate-400 text-sm mb-2">No posts match these filters.</p>
              <Link href="/author" className="text-indigo-600 text-xs hover:underline">Clear filters</Link>
            </>
          ) : (
            <>
              <p className="text-slate-400 text-sm mb-2">No posts yet.</p>
              <p className="text-slate-300 text-xs">
                Generate topics from the{' '}
                <Link href="/dashboard" className="text-indigo-600 hover:underline">Blog page</Link> to get started.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <SortHeader col="title" label="Title" />
                <SortHeader col="type" label="Type" className="w-24" />
                <SortHeader col="status" label="Status" className="w-32" />
                <SortHeader col="updated" label="Updated" className="w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(posts ?? []).map((post) => (
                <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/author/${post.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">
                      {post.title}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{post.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${post.content_type === 'faq' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}>
                      {post.content_type === 'faq' ? 'FAQ' : 'Blog'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full ${STATUS_STYLES[post.status ?? 'draft'] ?? 'bg-slate-100 text-slate-500'}`}>
                      {post.status?.replace('_', ' ') ?? 'draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(post.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-400">Page {page} of {totalPages} · {total} total</p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={buildHref({ page: String(page - 1) })} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300">← Prev</Link>
            ) : (
              <span className="text-sm px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300">← Prev</span>
            )}
            {page < totalPages ? (
              <Link href={buildHref({ page: String(page + 1) })} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300">Next →</Link>
            ) : (
              <span className="text-sm px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300">Next →</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
