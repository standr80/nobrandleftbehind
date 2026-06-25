import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import TriggerSuggestButton from '@/components/dashboard/TriggerSuggestButton'
import SuggestionsList from '@/components/dashboard/SuggestionsList'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { getReferenceUrls } from '@/lib/sites'

async function getDashboardStats(tenantId: string) {
  const db = createAdminClient()

  const [suggestionsRes, postsRes, referenceUrls] = await Promise.all([
    db
      .from('suggestions')
      .select('id, proposed_title, rationale, target_keywords, status, source, source_type')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    db
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    getReferenceUrls(tenantId),
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
    totalPosts: postsRes.count ?? 0,
    publishLog: publishLogRes.data ?? [],
    referenceSiteCount: referenceUrls.length,
  }
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) return null

  const workspace = await getActiveWorkspace(userId)

  // No workspace linked yet — show setup prompt
  if (!workspace) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Blog</h1>
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
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">Clem</span>
            <span className="text-xs text-slate-400">Blog Content · {tenant.domain}</span>
          </div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
        </div>
        <span className="text-xs bg-indigo-500/15 text-indigo-600 border border-indigo-200 px-3 py-1 rounded-full capitalize">
          {tenant.billing_tier}
        </span>
      </div>

      {/* Stats row — post-status cards link into the Editor, filtered */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Pending suggestions', value: stats.pendingSuggestions, href: null },
          { label: 'Drafts in review', value: stats.inReview, href: '/author?status=in_review' },
          { label: 'Scheduled posts', value: stats.scheduled, href: '/author?status=scheduled' },
          { label: 'Published this month', value: stats.publishedThisMonth, href: '/author?status=published' },
        ].map(({ label, value, href }) => {
          const card = (
            <>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-400 mt-1">{label}</p>
            </>
          )
          return href ? (
            <Link key={label} href={href} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 transition-colors">
              {card}
            </Link>
          ) : (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">{card}</div>
          )
        })}
      </div>

      {/* Recent posts */}
      {/* Empty state — only when the workspace has no posts at all. The full post
          list lives in the Editor (linked from the stat cards above). */}
      {stats.totalPosts === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 flex flex-col items-center text-center mb-8">
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
        <SuggestionsList key={tenant.id} suggestions={stats.suggestions} tenantId={tenant.id} />
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
      {stats.totalPosts > 0 && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-6 py-4">
          <div>
            <p className="text-sm font-medium">Generate new topics</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {stats.referenceSiteCount > 0
                ? `Suggest 5 new ideas based on your last site crawl and your ${stats.referenceSiteCount} reference site${stats.referenceSiteCount !== 1 ? 's' : ''}`
                : 'Suggest 5 new ideas based on your last site crawl'}
            </p>
          </div>
          <TriggerSuggestButton tenantId={tenant.id} currentSuggestionCount={stats.pendingSuggestions} />
        </div>
      )}
    </div>
  )
}
