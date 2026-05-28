/**
 * Scout Pipeline — Own Site Rank Tracking
 *
 * Captures weekly ranking snapshots for all tracked keywords,
 * calculates position changes vs last snapshot, and creates
 * Scout alerts for significant movements.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getDomainRankSnapshot } from '@/lib/integrations/dataforseo/client'

export interface RankSnapshotSummary {
  tracked: number
  improved: number
  declined: number
  enteredTop10: number
  droppedFromTop10: number
  biggestMover: { keyword: string; change: number; position: number } | null
}

export async function captureRankSnapshot(
  tenantId: string,
  domain: string,
): Promise<RankSnapshotSummary> {
  const db = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // 1. Get tracked keywords: pending/approved opportunities + current rankings
  const [oppsRes, rankingsLive] = await Promise.all([
    db
      .from('scout_keyword_opportunities')
      .select('keyword')
      .eq('tenant_id', tenantId)
      .neq('status', 'dismissed'),
    getDomainRankSnapshot(domain, 2826, 100),
  ])

  const oppKeywords = new Set((oppsRes.data ?? []).map((o) => o.keyword.toLowerCase()))
  const liveByKeyword = new Map(rankingsLive.map((r) => [r.keyword.toLowerCase(), r]))

  // Deduplicated keyword set: tracked opportunities + live rankings
  const allKeywords = new Set<string>([
    ...Array.from(oppKeywords),
    ...rankingsLive.map((r) => r.keyword.toLowerCase()),
  ])

  // Cap at 100
  const keywords = Array.from(allKeywords).slice(0, 100)

  // 2. Fetch previous snapshots for comparison
  const { data: prevSnapshots } = await db
    .from('scout_rank_history')
    .select('keyword, position, snapshot_date')
    .eq('tenant_id', tenantId)
    .in('keyword', keywords)
    .order('snapshot_date', { ascending: false })

  // Build map: keyword → most recent previous position
  const prevByKeyword = new Map<string, number | null>()
  for (const snap of prevSnapshots ?? []) {
    if (!prevByKeyword.has(snap.keyword)) {
      prevByKeyword.set(snap.keyword, snap.position)
    }
  }

  // 3. Build inserts
  const inserts: Array<{
    tenant_id: string
    keyword: string
    snapshot_date: string
    position: number | null
    previous_position: number | null
    position_change: number | null
    url: string | null
    search_volume: number | null
    source: string
  }> = []

  const summary: RankSnapshotSummary = {
    tracked: keywords.length,
    improved: 0,
    declined: 0,
    enteredTop10: 0,
    droppedFromTop10: 0,
    biggestMover: null,
  }

  const alerts: Array<{
    tenant_id: string
    alert_type: string
    severity: string
    title: string
    detail: string
  }> = []

  for (const kw of keywords) {
    const live = liveByKeyword.get(kw)
    const currentPos = live?.position ?? null
    const prevPos = prevByKeyword.get(kw) ?? null

    const change =
      currentPos !== null && prevPos !== null ? prevPos - currentPos : null // positive = improvement

    inserts.push({
      tenant_id: tenantId,
      keyword: kw,
      snapshot_date: today,
      position: currentPos,
      previous_position: prevPos,
      position_change: change,
      url: live?.url ?? null,
      search_volume: live?.search_volume ?? null,
      source: 'dataforseo',
    })

    if (change !== null) {
      if (change > 0) {
        summary.improved++
        if (!summary.biggestMover || change > summary.biggestMover.change) {
          summary.biggestMover = { keyword: kw, change, position: currentPos ?? 0 }
        }
      } else if (change < 0) {
        summary.declined++
      }
    }

    // Entered top 10
    if (currentPos !== null && currentPos <= 10 && (prevPos === null || prevPos > 10)) {
      summary.enteredTop10++
      alerts.push({
        tenant_id: tenantId,
        alert_type: 'rank_entered_top10',
        severity: 'watch',
        title: `"${kw}" entered the top 10`,
        detail: `Now ranking at position ${currentPos}${prevPos ? ` (was ${prevPos})` : ''}.`,
      })
    }

    // Dropped from top 10
    if (prevPos !== null && prevPos <= 10 && currentPos !== null && currentPos > 10) {
      summary.droppedFromTop10++
      alerts.push({
        tenant_id: tenantId,
        alert_type: 'rank_dropped_top10',
        severity: 'urgent',
        title: `"${kw}" dropped out of top 10`,
        detail: `Now at position ${currentPos} (was ${prevPos}).`,
      })
    }

    // Big improvement
    if (change !== null && change > 5) {
      alerts.push({
        tenant_id: tenantId,
        alert_type: 'rank_improvement',
        severity: 'watch',
        title: `"${kw}" jumped ${change} places`,
        detail: `Now position ${currentPos} (was ${prevPos}).`,
      })
    }

    // Big decline
    if (change !== null && change < -5) {
      alerts.push({
        tenant_id: tenantId,
        alert_type: 'rank_decline',
        severity: 'watch',
        title: `"${kw}" dropped ${Math.abs(change)} places`,
        detail: `Now position ${currentPos} (was ${prevPos}).`,
      })
    }
  }

  // 4. Upsert snapshots
  if (inserts.length) {
    await db
      .from('scout_rank_history')
      .upsert(inserts, { onConflict: 'tenant_id,keyword,snapshot_date', ignoreDuplicates: true })
  }

  // 5. Insert alerts (deduplicate: only one alert per type+keyword per day)
  for (const alert of alerts) {
    await db.from('scout_alerts').insert(alert).select().maybeSingle()
  }

  return summary
}
