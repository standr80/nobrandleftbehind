import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, getAllWorkspaces } from '@/lib/workspace/active'
import DashboardNav from '@/components/layout/DashboardNav'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const isSuperAdmin = userId === PLATFORM_ADMIN_ID
  const db = createAdminClient()

  const [activeWorkspace, allWorkspaces, quotaRes] = await Promise.all([
    getActiveWorkspace(userId),
    getAllWorkspaces(userId),
    isSuperAdmin
      ? Promise.resolve({ data: null })
      : db.from('workspace_quotas').select('max_workspaces').eq('clerk_user_id', userId).maybeSingle(),
  ])

  const quota = isSuperAdmin ? Infinity : (quotaRes.data?.max_workspaces ?? 0)
  const canCreateWorkspace = isSuperAdmin || (quota > 0 && allWorkspaces.length < quota)

  const navWorkspaces = allWorkspaces.map((w) => ({
    tenantId: w.tenantId,
    role: w.role,
    name: w.tenant?.name ?? w.tenant?.domain ?? 'Workspace',
  }))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <DashboardNav
        isSuperAdmin={isSuperAdmin}
        canCreateWorkspace={canCreateWorkspace}
        workspaces={navWorkspaces}
        activeWorkspaceId={activeWorkspace?.tenantId ?? null}
      />
      {/* pt-[57px] clears the fixed mobile top bar; md overrides to 0 */}
      <main className="flex-1 min-w-0 p-4 pt-[73px] md:pt-8 md:p-8">{children}</main>
    </div>
  )
}
