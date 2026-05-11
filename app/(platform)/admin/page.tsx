import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminTriggers from './AdminTriggers'
import CreateWorkspaceForm from './CreateWorkspaceForm'
import WorkspaceManage from './WorkspaceManage'
import QuotaManager from './QuotaManager'
import UserList from './UserList'

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

  // Fetch workspace creation quotas (with Clerk user info joined manually)
  const { data: rawQuotas } = await db
    .from('workspace_quotas')
    .select('id, clerk_user_id, max_workspaces, notes, created_at')
    .order('created_at', { ascending: false })

  // Enrich quotas with email/name from tenant_members (best-effort)
  const memberEmailMap: Record<string, { email: string | null; name: string | null }> = {}
  // Fetch all members to build a clerk_user_id → email/name map
  const { data: allMembersForMap } = await db
    .from('tenant_members')
    .select('clerk_user_id, email, name')
  for (const m of allMembersForMap ?? []) {
    if (!memberEmailMap[m.clerk_user_id]) {
      memberEmailMap[m.clerk_user_id] = { email: m.email, name: m.name }
    }
  }
  const quotas = (rawQuotas ?? []).map((q) => ({
    ...q,
    email: memberEmailMap[q.clerk_user_id]?.email ?? null,
    name: memberEmailMap[q.clerk_user_id]?.name ?? null,
  }))

  // Fetch members for all workspaces in one go
  const { data: rawMembers } = await db
    .from('tenant_members')
    .select('id, tenant_id, name, email, role, clerk_user_id, created_at')
    .order('created_at', { ascending: true })

  // Enrich members with live Clerk data (name + primary email + last sign-in)
  const uniqueClerkIds = [...new Set((rawMembers ?? []).map((m) => m.clerk_user_id))]
  type ClerkUserInfo = { name: string | null; email: string | null; lastSignInAt: number | null }
  const clerkInfoMap: Record<string, ClerkUserInfo> = {}
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
            email: u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress
              ?? u.emailAddresses[0]?.emailAddress
              ?? null,
            lastSignInAt: u.lastSignInAt ?? null,
          }
        }
      }
    } catch (err) {
      console.error('[admin] Failed to fetch Clerk user info:', err)
    }
  }

  const allMembers = (rawMembers ?? []).map((m) => {
    const ci = clerkInfoMap[m.clerk_user_id]
    return {
      ...m,
      name: m.name ?? ci?.name ?? null,
      email: m.email ?? ci?.email ?? null,
      lastSignInAt: ci?.lastSignInAt ?? null,
    }
  })

  // Build per-workspace member lists (for WorkspaceManage panels)
  const membersByTenant: Record<string, typeof allMembers> = {}
  for (const m of allMembers) {
    if (!membersByTenant[m.tenant_id]) membersByTenant[m.tenant_id] = []
    membersByTenant[m.tenant_id]!.push(m)
  }

  // Build user list data (for UserList section)
  const tenantNameMap = Object.fromEntries((tenants ?? []).map((t) => [t.id, t.name]))
  type UserRow = {
    clerkUserId: string
    name: string | null
    email: string | null
    lastSignInAt: number | null
    memberships: Array<{ tenantId: string; tenantName: string; role: string }>
  }
  const userRowMap: Record<string, UserRow> = {}
  for (const m of allMembers) {
    if (!userRowMap[m.clerk_user_id]) {
      userRowMap[m.clerk_user_id] = {
        clerkUserId: m.clerk_user_id,
        name: m.name,
        email: m.email,
        lastSignInAt: m.lastSignInAt,
        memberships: [],
      }
    }
    userRowMap[m.clerk_user_id]!.memberships.push({
      tenantId: m.tenant_id,
      tenantName: tenantNameMap[m.tenant_id] ?? m.tenant_id,
      role: m.role,
    })
  }
  const userRows = Object.values(userRowMap).sort((a, b) =>
    (b.lastSignInAt ?? 0) - (a.lastSignInAt ?? 0),
  )

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
          { label: 'Workspaces', value: tenants?.length ?? 0 },
          { label: 'Total posts', value: totalPosts },
          { label: 'Total published', value: totalPublished },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/40 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Workspace table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white/70">All workspaces</h2>
        </div>
        <ul className="divide-y divide-white/5">
          {(tenants ?? []).map((t) => {
            const s = statsMap[t.id]
            const members = membersByTenant[t.id] ?? []
            return (
              <li key={t.id}>
                <div className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-sm font-medium text-white">{t.name}</p>
                        <span className="text-xs text-white/30 font-mono">{t.domain}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-white/30">
                        <span>{s?.totalPosts ?? 0} posts</span>
                        <span>{s?.published ?? 0} published</span>
                        <span>{s?.pendingSuggestions ?? 0} pending</span>
                        <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                        <span className="capitalize">{t.cms_type ?? 'download'}</span>
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
      {/* Workspace creation quotas */}
      <QuotaManager quotas={quotas} />

      {/* User list */}
      <UserList users={userRows} />
    </div>
  )
}
