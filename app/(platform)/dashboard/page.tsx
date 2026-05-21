import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import TriggerSuggestButton from '@/components/dashboard/TriggerSuggestButton'
import SuggestionsList from '@/components/dashboard/SuggestionsList'
import WorkspaceSwitcher from '@/components/dashboard/WorkspaceSwitcher'
import { getActiveWorkspace, getAllWorkspaces } from '@/lib/workspace/active'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

async function getDashboardStats(tenantId: string) {
  const db = createAdminClient()

  const [suggestionsRes, postsRes] = await Promise.all([
    db
      .from('suggestions')
      .select('id, proposed_title, rationale, target_keywords, status, source, source_type')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    db
      .from('blog_posts')
      .select('id, status, title, slug, created_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const scheduledRes = await db
    .from('blog_posts')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')

  const publishedRes = await db
    .from('blog_posts')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .gte('created_at', new Date(new Date().setDate(1)).toISOString()) // this month

  const inReviewRes = await db
    .from('blog_posts')
    .select('id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'in_review')

  const publishLogRes = await db
    .from('publish_log')
    .select('id, action, success, git_pr_url, attempted_at, error_message, blog_posts(title)')
    .eq('tenant_id', tenantId)
    .order('attempted_at', { ascending: false })
    .limit(10)

  const suggestions = suggestionsRes.data ?? []

  return {
    pendingSuggestions: suggestions.length,
    suggestions,
    inReview: inReviewRes.count ?? 0,
    scheduled: scheduledRes.count ?? 0,
    publishedThisMonth: publishedRes.count ?? 0,
    recentPosts: postsRes.data ?? [],
    publishLog: publishLogRes.data ?? [],
  }
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  in_review: 'bg-blue-50 text-blue-700',
  approved: 'bg-green-500/10 text-green-300',
  scheduled: 'bg-purple-50 text-purple-700',
  published: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-600',
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) return null

  const isSuperAdmin = userId === PLATFORM_ADMIN_ID
  const db = createAdminClient()

  const [workspace, allWorkspaces, quotaRes] = await Promise.all([
    getActiveWorkspace(userId),
    getAllWorkspaces(userId),
    isSuperAdmin
      ? Promise.resolve({ data: null })
      : db.from('workspace_quotas').select('max_workspaces').eq('clerk_user_id', userId).maybeSingle(),
  ])

  const quota = isSuperAdmin ? Infinity : (quotaRes.data?.max_workspaces ?? 0)
  const canCreateWorkspace = isSuperAdmin || (quota > 0 && allWorkspaces.length < quota)

  // No workspace linked yet — show setup prompt
  if (!workspace) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mt-8">
          <p className="text-slate-600 mb-4">Your account isn&apos;t linked to a workspace yet.</p>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Ask your workspace admin to send you an invite, or{' '}
            <Link href="/setup" className="text-indigo-600 hover:text-indigo-600">set up a new workspace</Link>.
          </p>
        </div>
      </div>
    )
  }

  const tenant = workspace.tenant
  const stats = await getDashboardStats(tenant.id)

  return (
    <div className="max-w-5xl">
      {/* Workspace switcher */}
      {allWorkspaces.length > 0 && (
        <div className="mb-6">
          <WorkspaceSwitcher
            workspaces={allWorkspaces}
            activeId={workspace.tenantId}
            canCreateWorkspace={canCreateWorkspace}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-slate-400 mb-1">{tenant.domain}</p>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
        </div>
        <span className="text-xs bg-indigo-500/15 text-indigo-600 border border-indigo-200 px-3 py-1 rounded-full capitalize">
          {tenant.billing_tier}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Pending suggestions', value: stats.pendingSuggestions },
          { label: 'Drafts in review', value: stats.inReview },
          { label: 'Scheduled posts', value: stats.scheduled },
          { label: 'Published this month', value: stats.publishedThisMonth },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent posts */}
      {stats.recentPosts.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-700">Recent posts</h2>
            <Link
              href="/author"
              className="text-xs text-indigo-600 hover:text-indigo-600 transition-colors"
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {stats.recentPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/author/${post.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-white transition-colors"
                >
                  <span className="text-sm text-slate-800 truncate mr-4">{post.title}</span>
                  <span
                    className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full ${post.status ? (STATUS_STYLES[post.status] ?? 'bg-slate-100 text-slate-500') : 'bg-slate-100 text-slate-500'}`}
                  >
                    {post.status?.replace('_', ' ') ?? 'draft'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        /* Empty state */
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-3xl mb-6">
            ✦
          </div>
          <h2 className="text-xl font-semibold mb-2">Clem is ready</h2>
          <p className="text-slate-400 text-sm max-w-sm mb-8">
            Generate topic suggestions and Clem will research, write, and queue them for your
            review.
          </p>
          <TriggerSuggestButton tenantId={tenant.id} currentSuggestionCount={stats.pendingSuggestions} />
          <p className="text-xs text-slate-300 mt-6">
            Cadence: {tenant.publish_cadence} · {tenant.publish_days?.join(', ')} at{' '}
            {tenant.publish_time}
          </p>
        </div>
      )}

      {/* Pending suggestions list — always visible so Add your own is accessible */}
      <div className="mb-8">
        <SuggestionsList suggestions={stats.suggestions} tenantId={tenant.id} />
      </div>

      {/* Publish log */}
      {stats.publishLog.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-medium text-slate-700">Publish log</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {stats.publishLog.map((entry) => {
              const postTitle = Array.isArray(entry.blog_posts)
                ? entry.blog_posts[0]?.title
                : (entry.blog_posts as { title: string } | null)?.title
              return (
                <li key={entry.id} className="flex items-center gap-4 px-6 py-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 truncate">{postTitle ?? 'Unknown post'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {entry.action?.replace('_', ' ')}
                      {entry.error_message && (
                        <span className="text-red-600 ml-2">{entry.error_message}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {entry.git_pr_url && (
                      <a
                        href={entry.git_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-600 transition-colors block mb-0.5"
                      >
                        View PR →
                      </a>
                    )}
                    <span className="text-xs text-slate-300">
                      {new Date(entry.attempted_at!).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Generate button when posts exist */}
      {stats.recentPosts.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-6 py-4">
          <div>
            <p className="text-sm font-medium">Generate new topics</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Suggest 5 new ideas based on your last site crawl
            </p>
          </div>
          <TriggerSuggestButton tenantId={tenant.id} currentSuggestionCount={stats.pendingSuggestions} />
        </div>
      )}
    </div>
  )
}
