import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminTriggers from './AdminTriggers'
import CreateWorkspaceForm from './CreateWorkspaceForm'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

export default async function AdminPage() {
  const { userId } = await auth()
  if (!userId) return null
  if (userId !== PLATFORM_ADMIN_ID) redirect('/dashboard')

  const db = createAdminClient()

  const { data: tenants } = await db
    .from('tenants')
    .select('id, name, domain, billing_tier, created_at, cms_type, publish_cadence')
    .order('created_at', { ascending: false })

  const statsPromises = (tenants ?? []).map(async (t) => {
    const [postsRes, publishedRes, suggestionsRes] = await Promise.all([
      db.from('blog_posts').select('id', { count: 'exact' }).eq('tenant_id', t.id),
      db.from('blog_posts').select('id', { count: 'exact' }).eq('tenant_id', t.id).eq('status', 'published'),
      db.from('suggestions').select('id', { count: 'exact' }).eq('tenant_id', t.id).eq('status', 'pending'),
    ])
    return {
      tenantId: t.id,
      totalPosts: postsRes.count ?? 0,
      published: publishedRes.count ?? 0,
      pendingSuggestions: suggestionsRes.count ?? 0,
    }
  })

  const statsArray = await Promise.all(statsPromises)
  const statsMap = Object.fromEntries(statsArray.map((s) => [s.tenantId, s]))

  const totalPosts = statsArray.reduce((sum, s) => sum + s.totalPosts, 0)
  const totalPublished = statsArray.reduce((sum, s) => sum + s.published, 0)

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Platform admin</h1>
          <p className="text-white/40 text-sm">Superadmin access only.</p>
        </div>
        <CreateWorkspaceForm />
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Tenants', value: tenants?.length ?? 0 },
          { label: 'Total posts', value: totalPosts },
          { label: 'Total published', value: totalPublished },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/40 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tenant table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white/70">All tenants</h2>
        </div>
        <ul className="divide-y divide-white/5">
          {(tenants ?? []).map((t) => {
            const s = statsMap[t.id]
            return (
              <li key={t.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <span className="text-xs text-white/30 font-mono">{t.domain}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      <span>{s?.totalPosts ?? 0} posts</span>
                      <span>{s?.published ?? 0} published</span>
                      <span>{s?.pendingSuggestions ?? 0} pending suggestions</span>
                      <span className="capitalize">{t.cms_type ?? 'download'}</span>
                      <span>{t.publish_cadence}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border capitalize ${
                      t.billing_tier === 'agency'
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                        : t.billing_tier === 'growth'
                          ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                          : 'bg-white/5 text-white/40 border-white/10'
                    }`}>
                      {t.billing_tier}
                    </span>
                    <AdminTriggers tenantId={t.id} tenantName={t.name} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
