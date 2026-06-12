import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { getCompetitorUrls } from '@/lib/sites'
import CompetitorManager from '@/components/scout/CompetitorManager'

export default async function CompetitorsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()

  const [snapshotsRes, competitorUrls] = await Promise.all([
    db
      .from('scout_competitor_snapshots')
      .select('id, competitor_url, snapshot_date, page_count, new_blog_posts, pricing_changed, pricing_change_summary, created_at')
      .eq('tenant_id', workspace.tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
    getCompetitorUrls(workspace.tenantId),
  ])

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
        Scout monitors the sites flagged as <strong>Competitor</strong> in Settings → Sites.
        Crawl a site immediately below, or let Scout pick it up on its weekly run.
      </p>

      <CompetitorManager
        tenantId={workspace.tenantId}
        competitorUrls={competitorUrls}
        latestSnapshots={Object.values(latestByUrl)}
      />
    </div>
  )
}
