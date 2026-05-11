import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import QuotaManager from '../QuotaManager'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

export default async function QuotasPage() {
  const { userId } = await auth()
  if (!userId || userId !== PLATFORM_ADMIN_ID) redirect('/dashboard')

  const db = createAdminClient()

  const { data: rawQuotas } = await db
    .from('workspace_quotas')
    .select('id, clerk_user_id, max_workspaces, notes, created_at')
    .order('created_at', { ascending: false })

  // Enrich quotas with name/email — try Clerk first, fall back to tenant_members
  const quotaClerkIds = (rawQuotas ?? []).map((q) => q.clerk_user_id)
  const clerkInfoMap: Record<string, { name: string | null; email: string | null }> = {}

  if (quotaClerkIds.length > 0) {
    try {
      const clerk = await clerkClient()
      const res = await clerk.users.getUserList({ userId: quotaClerkIds, limit: 100 })
      for (const u of res.data) {
        clerkInfoMap[u.id] = {
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || null,
          email:
            u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
            u.emailAddresses[0]?.emailAddress ??
            null,
        }
      }
    } catch (err) {
      console.error('[admin/quotas] Clerk fetch failed:', err)
    }
  }

  // Fall back to tenant_members for any Clerk IDs not resolved
  const unresolvedIds = quotaClerkIds.filter((id) => !clerkInfoMap[id])
  if (unresolvedIds.length > 0) {
    const { data: members } = await db
      .from('tenant_members')
      .select('clerk_user_id, email, name')
      .in('clerk_user_id', unresolvedIds)
    for (const m of members ?? []) {
      if (!clerkInfoMap[m.clerk_user_id]) {
        clerkInfoMap[m.clerk_user_id] = { email: m.email, name: m.name }
      }
    }
  }

  const quotas = (rawQuotas ?? []).map((q) => ({
    ...q,
    email: clerkInfoMap[q.clerk_user_id]?.email ?? null,
    name: clerkInfoMap[q.clerk_user_id]?.name ?? null,
  }))

  return (
    <div>
      <p className="text-sm text-slate-400 mb-6">
        Control which users can create their own workspaces and how many.
      </p>
      <QuotaManager quotas={quotas} />
    </div>
  )
}
