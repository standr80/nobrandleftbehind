import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import Link from 'next/link'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  in_review: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-500/10 text-green-300',
  scheduled: 'bg-purple-50 text-purple-700',
  published: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
}

const STATUS_ORDER = ['in_review', 'draft', 'approved', 'scheduled', 'published', 'rejected']

export default async function AuthorPage() {
  const { userId } = await auth()
  if (!userId) return null

  const workspace = await getActiveWorkspace(userId)

  if (!workspace) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold mb-8">Author</h1>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm">No workspace linked to your account.</p>
        </div>
      </div>
    )
  }

  const db = createAdminClient()

  const { data: posts } = await db
    .from('blog_posts')
    .select('id, title, slug, status, drafted_at, approved_at, scheduled_for, created_at')
    .eq('tenant_id', workspace.tenantId)
    .order('created_at', { ascending: false })

  const grouped = STATUS_ORDER.reduce<Record<string, typeof posts>>((acc, status) => {
    acc[status] = (posts ?? []).filter((p) => p.status === status)
    return acc
  }, {})

  const totalActive = (posts ?? []).filter(
    (p) => p.status !== 'published' && p.status !== 'rejected',
  ).length

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Clem</span>
            <span className="text-xs text-slate-400">{workspace.tenant.name} · {workspace.tenant.domain}</span>
          </div>
          <h1 className="text-2xl font-bold">Author</h1>
          <p className="text-sm text-slate-400 mt-1">
            {totalActive} post{totalActive !== 1 ? 's' : ''} in progress
          </p>
        </div>
      </div>

      {!posts?.length ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm mb-2">No posts yet.</p>
          <p className="text-slate-300 text-xs">
            Generate topics from the{' '}
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-600">
              dashboard
            </Link>{' '}
            and draft a post to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {STATUS_ORDER.map((status) => {
            const group = grouped[status] ?? []
            if (!group.length) return null
            return (
              <section key={status}>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {status.replace('_', ' ')} ({group.length})
                </h2>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {group.map((post) => (
                      <li key={post.id}>
                        <Link
                          href={`/author/${post.id}`}
                          className="flex items-center justify-between px-5 py-4 hover:bg-white transition-colors group"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                              {post.title}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">{post.slug}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            {post.scheduled_for && (
                              <span className="text-xs text-slate-400 hidden sm:block">
                                {new Date(post.scheduled_for).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            )}
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full ${STATUS_STYLES[post.status ?? 'draft'] ?? 'bg-slate-100 text-slate-500'}`}
                            >
                              {post.status?.replace('_', ' ')}
                            </span>
                            <span className="text-slate-300 group-hover:text-slate-600 transition-colors">→</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
