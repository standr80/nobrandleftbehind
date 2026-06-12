import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import KeywordOpportunityList from '@/components/scout/KeywordOpportunityList'

export default async function KeywordsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) redirect('/setup')

  const db = createAdminClient()
  const { data: opportunities } = await db
    .from('scout_keyword_opportunities')
    .select('id, keyword, search_volume, keyword_difficulty, opportunity_type, competitor_ranking_url, seasonal_peak_month, weeks_until_peak, status, clem_suggestion_id, discovered_at, has_ai_overview, ai_overview_snippet')
    .eq('tenant_id', workspace.tenantId)
    .order('discovered_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Keyword opportunities</h1>
      <p className="text-sm text-slate-500 mb-6">
        Scout-discovered opportunities. Approve to add to Clem&apos;s queue, or dismiss to remove.
      </p>
      <KeywordOpportunityList
        key={workspace.tenantId}
        initialOpportunities={opportunities ?? []}
      />
    </div>
  )
}
