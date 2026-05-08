import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAllWorkspaces } from '@/lib/workspace/active'
import SetupWizard from './SetupWizard'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

export default async function SetupPage() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createAdminClient()

  // Superadmin can always create workspaces
  const isSuperAdmin = userId === PLATFORM_ADMIN_ID

  // Fetch the user's current workspaces and their quota in parallel
  const [allWorkspaces, quotaRes] = await Promise.all([
    getAllWorkspaces(userId),
    db.from('workspace_quotas').select('max_workspaces').eq('clerk_user_id', userId).maybeSingle(),
  ])

  const quota = isSuperAdmin ? Infinity : (quotaRes.data?.max_workspaces ?? 0)
  const current = allWorkspaces.length

  // Already at or over quota — redirect to dashboard
  if (current > 0 && current >= quota) {
    redirect('/dashboard')
  }

  // Has quota but hasn't used it yet, OR superadmin
  if (quota === 0 && !isSuperAdmin) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Create a workspace</h1>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-3xl mb-4">🔒</div>
          <p className="text-white/60 mb-2">Workspace creation is invite-only.</p>
          <p className="text-white/30 text-sm max-w-sm mx-auto">
            Contact your platform admin to be granted workspace creation access,
            or ask to be invited to an existing workspace.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">
          {current === 0 ? 'Set up your workspace' : 'Create another workspace'}
        </h1>
        <p className="text-white/40 text-sm">
          Tell Clem about your website so it can write content that sounds like you.
          {quota !== Infinity && (
            <span className="ml-1 text-white/20">
              ({current}/{quota} workspace{quota !== 1 ? 's' : ''} used)
            </span>
          )}
        </p>
      </div>
      <SetupWizard />
    </div>
  )
}
