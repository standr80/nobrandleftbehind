import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import CompetitorManager from '@/components/scout/CompetitorManager'

export default async function CompetitorsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()

  const [configRes, snapshotsRes] = await Promise.all([
    db.from('scout_config').select('*').eq('tenant_id', workspace.tenantId).maybeSingle(),
    db
      .from('scout_competitor_snapshots')
      .select('id, competitor_url, snapshot_date, page_count, new_blog_posts, pricing_changed, pricing_change_summary, created_at')
      .eq('tenant_id', workspace.tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const competitorUrls: string[] = configRes.data?.competitor_urls ?? []

  type SnapshotRow = NonNullable<typeof snapshotsRes.data>[number]
  // Group snapshots by competitor URL — latest per competitor
  const latestByUrl: Record<string, SnapshotRow> = {}
  for (const s of snapshotsRes.data ?? []) {
    if (!latestByUrl[s.competitor_url]) {
      latestByUrl[s.competitor_url] = s
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Competitors</h1>
      <p className="text-sm text-slate-500 mb-6">
        Scout monitors up to 5 competitor URLs weekly. Add URLs to track content changes, pricing, and keyword gaps.
      </p>

      <CompetitorManager
        initialUrls={competitorUrls}
        latestSnapshots={Object.values(latestByUrl)}
        isAdmin={workspace.role === 'admin'}
      />
    </div>
  )
}
