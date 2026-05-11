import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminTriggers from '../AdminTriggers'
import CreateWorkspaceForm from '../CreateWorkspaceForm'
import WorkspaceManage from '../WorkspaceManage'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

export default async function WorkspacesPage() {
  const { userId } = await auth()
  if (!userId || userId !== PLATFORM_ADMIN_ID) redirect('/dashboard')

  const db = createAdminClient()

  const { data: tenants } = await db
    .from('tenants')
    .select('id, name, domain, billing_tier, created_at, cms_type, publish_cadence')
    .order('created_at', { ascending: false })

  // Fetch all members and enrich with Clerk data
  const { data: rawMembers } = await db
    .from('tenant_members')
    .select('id, tenant_id, name, email, role, clerk_user_id, created_at')
    .order('created_at', { ascending: true })

  const uniqueClerkIds = [...new Set((rawMembers ?? []).map((m) => m.clerk_user_id))]
  type ClerkInfo = { name: string | null; email: string | null }
  const clerkInfoMap: Record<string, ClerkInfo> = {}
  if (uniqueClerkIds.length > 0) {
    try {
      const clerk = await clerkClient()
      const BATCH = 100
      for (let i = 0; i < uniqueClerkIds.length; i += BATCH) {
        const batch = uniqueClerkIds.slice(i, i + BATCH)
        const res = await clerk.users.getUserList({ userId: batch, limit: BATCH })
        for (const u of res.data) {
          clerkInfoMap[u.id] = {
            name: [u.firstName, u.lastName].filter(Boolean).join(' ') || null,
            email:
              u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
              u.emailAddresses[0]?.emailAddress ??
              null,
          }
        }
      }
    } catch (err) {
      console.error('[admin/workspaces] Clerk fetch failed:', err)
    }
  }

  const allMembers = (rawMembers ?? []).map((m) => {
    const ci = clerkInfoMap[m.clerk_user_id]
    return {
      ...m,
      name: m.name ?? ci?.name ?? null,
      email: m.email ?? ci?.email ?? null,
    }
  })

  const membersByTenant: Record<string, typeof allMembers> = {}
  for (const m of allMembers) {
    if (!membersByTenant[m.tenant_id]) membersByTenant[m.tenant_id] = []
    membersByTenant[m.tenant_id]!.push(m)
  }

  // Per-workspace stats
  const statsArray = await Promise.all(
    (tenants ?? []).map(async (t) => {
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
    }),
  )

  const statsMap = Object.fromEntries(statsArray.map((s) => [s.tenantId, s]))
  const totalPosts = statsArray.reduce((sum, s) => sum + s.totalPosts, 0)
  const totalPublished = statsArray.reduce((sum, s) => sum + s.published, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-400">
          {tenants?.length ?? 0} workspace{(tenants?.length ?? 0) !== 1 ? 's' : ''}
          {' · '}
          {totalPosts} posts
          {' · '}
          {totalPublished} published
        </p>
        <CreateWorkspaceForm />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {(tenants ?? []).map((t) => {
            const s = statsMap[t.id]
            const members = membersByTenant[t.id] ?? []
            return (
              <li key={t.id}>
                <div className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-sm font-medium text-slate-900">{t.name}</p>
                        <span className="text-xs text-slate-400 font-mono">{t.domain}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>{s?.totalPosts ?? 0} posts</span>
                        <span>{s?.published ?? 0} published</span>
                        <span>{s?.pendingSuggestions ?? 0} pending</span>
                        <span>
                          {members.length} member{members.length !== 1 ? 's' : ''}
                        </span>
                        <span className="capitalize">{t.cms_type ?? 'download'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border capitalize ${
                          t.billing_tier === 'agency'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : t.billing_tier === 'growth'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-white text-slate-400 border-slate-200'
                        }`}
                      >
                        {t.billing_tier}
                      </span>
                      <AdminTriggers tenantId={t.id} tenantName={t.name} />
                    </div>
                  </div>
                </div>
                <WorkspaceManage
                  workspaceId={t.id}
                  workspaceName={t.name}
                  members={members}
                />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
