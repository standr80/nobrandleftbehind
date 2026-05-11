import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllWorkspaces } from '@/lib/workspace/active'
import DashboardNav from '@/components/layout/DashboardNav'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const isSuperAdmin = userId === PLATFORM_ADMIN_ID

  // Check if the user has unused workspace creation quota
  let canCreateWorkspace = isSuperAdmin
  if (!isSuperAdmin) {
    const db = createAdminClient()
    const [allWorkspaces, quotaRes] = await Promise.all([
      getAllWorkspaces(userId),
      db.from('workspace_quotas').select('max_workspaces').eq('clerk_user_id', userId).maybeSingle(),
    ])
    const quota = quotaRes.data?.max_workspaces ?? 0
    canCreateWorkspace = quota > 0 && allWorkspaces.length < quota
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <DashboardNav isSuperAdmin={isSuperAdmin} canCreateWorkspace={canCreateWorkspace} />
      {/* pt-[57px] clears the fixed mobile top bar; md overrides to 0 */}
      <main className="flex-1 min-w-0 p-4 pt-[73px] md:pt-8 md:p-8">{children}</main>
    </div>
  )
}
