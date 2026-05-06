import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import TriggerSuggestButton from '@/components/dashboard/TriggerSuggestButton'

async function getTenantForUser(clerkUserId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('tenant_members')
    .select('tenant_id, role, tenants(*)')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle()
  return data
}

async function getDashboardStats(tenantId: string) {
  const db = createAdminClient()

  const [suggestionsRes, postsRes] = await Promise.all([
    db
      .from('suggestions')
      .select('id, status', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
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

  return {
    pendingSuggestions: suggestionsRes.count ?? 0,
    inReview: inReviewRes.count ?? 0,
    scheduled: scheduledRes.count ?? 0,
    publishedThisMonth: publishedRes.count ?? 0,
    recentPosts: postsRes.data ?? [],
  }
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-yellow-500/10 text-yellow-300',
  in_review: 'bg-blue-500/10 text-blue-300',
  approved: 'bg-green-500/10 text-green-300',
  scheduled: 'bg-purple-500/10 text-purple-300',
  published: 'bg-emerald-500/10 text-emerald-300',
  rejected: 'bg-red-500/10 text-red-300',
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) return null

  const membership = await getTenantForUser(userId)

  // No tenant linked yet — show setup prompt
  if (!membership) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center mt-8">
          <p className="text-white/60 mb-4">Your account isn&apos;t linked to a tenant yet.</p>
          <p className="text-white/30 text-sm max-w-sm mx-auto">
            Run the SQL in{' '}
            <code className="text-indigo-300">supabase/migrations/002_seed_designs_on_print.sql</code>{' '}
            and add yourself to the <code className="text-indigo-300">tenant_members</code> table.
          </p>
        </div>
      </div>
    )
  }

  const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants
  if (!tenant) return null

  const stats = await getDashboardStats(tenant.id)

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-white/40 mb-1">{tenant.domain}</p>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
        </div>
        <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full capitalize">
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
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/40 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent posts */}
      {stats.recentPosts.length > 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/70">Recent posts</h2>
            <Link
              href="/author"
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-white/5">
            {stats.recentPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/author/${post.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm text-white/80 truncate mr-4">{post.title}</span>
                  <span
                    className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full ${post.status ? (STATUS_STYLES[post.status] ?? 'bg-white/10 text-white/50') : 'bg-white/10 text-white/50'}`}
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
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-3xl mb-6">
            ✦
          </div>
          <h2 className="text-xl font-semibold mb-2">Clem is ready</h2>
          <p className="text-white/40 text-sm max-w-sm mb-8">
            Generate topic suggestions and Clem will research, write, and queue them for your
            review.
          </p>
          <TriggerSuggestButton tenantId={tenant.id} />
          <p className="text-xs text-white/20 mt-6">
            Cadence: {tenant.publish_cadence} · {tenant.publish_days?.join(', ')} at{' '}
            {tenant.publish_time}
          </p>
        </div>
      )}

      {/* Generate button when posts exist */}
      {stats.recentPosts.length > 0 && (
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-6 py-4">
          <div>
            <p className="text-sm font-medium">Generate new topics</p>
            <p className="text-xs text-white/40 mt-0.5">
              Clem will crawl {tenant.domain} and suggest 5 new ideas
            </p>
          </div>
          <TriggerSuggestButton tenantId={tenant.id} />
        </div>
      )}
    </div>
  )
}
