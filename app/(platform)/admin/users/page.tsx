import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import UserList from '../UserList'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

export default async function UsersPage() {
  const { userId } = await auth()
  if (!userId || userId !== PLATFORM_ADMIN_ID) redirect('/dashboard')

  const db = createAdminClient()

  const [{ data: rawMembers }, { data: tenants }] = await Promise.all([
    db
      .from('tenant_members')
      .select('id, tenant_id, name, email, role, clerk_user_id, created_at')
      .order('created_at', { ascending: true }),
    db.from('tenants').select('id, name'),
  ])

  const uniqueClerkIds = [...new Set((rawMembers ?? []).map((m) => m.clerk_user_id))]
  type ClerkInfo = { name: string | null; email: string | null; lastSignInAt: number | null }
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
            lastSignInAt: u.lastSignInAt ?? null,
          }
        }
      }
    } catch (err) {
      console.error('[admin/users] Clerk fetch failed:', err)
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
  const userRows = Object.values(userRowMap).sort(
    (a, b) => (b.lastSignInAt ?? 0) - (a.lastSignInAt ?? 0),
  )

  return (
    <div>
      <p className="text-sm text-white/40 mb-6">
        All accounts that have joined Clem, sorted by most recent sign-in.
      </p>
      <UserList users={userRows} />
    </div>
  )
}
