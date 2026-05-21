import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import ScoutSettingsForm from '@/components/scout/ScoutSettingsForm'

export default async function ScoutSettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()
  const { data: config } = await db
    .from('scout_config')
    .select('*')
    .eq('tenant_id', workspace.tenantId)
    .maybeSingle()

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Scout settings</h1>
      <p className="text-sm text-slate-500 mb-6">
        Configure Scout&apos;s briefing schedule and data sources.
      </p>
      <ScoutSettingsForm
        initialConfig={config}
        isAdmin={workspace.role === 'admin'}
        hasDatasforSeoKey={!!process.env.DATAFORSEO_LOGIN}
      />
    </div>
  )
}
