import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import SettingsForm from './SettingsForm'
import type { ReferenceSummary } from '@/lib/clem/suggest'

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const workspace = await getActiveWorkspace(userId)

  if (!workspace) redirect('/setup')

  const { tenant, role } = workspace
  const db = createAdminClient()

  const [{ data: members }, { data: crawlCache }] = await Promise.all([
    db
      .from('tenant_members')
      .select('id, name, email, role, clerk_user_id, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: true }),
    db
      .from('site_crawl_cache')
      .select('crawled_at, reference_summaries')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
  ])

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Workspace settings</h1>
        <p className="text-slate-400 text-sm">{tenant.domain}</p>
      </div>
      <SettingsForm
        tenant={tenant}
        members={members ?? []}
        isAdmin={role === 'admin'}
        crawledAt={crawlCache?.crawled_at ?? null}
        referenceSummaries={(crawlCache?.reference_summaries as unknown as ReferenceSummary[]) ?? []}
      />
    </div>
  )
}
