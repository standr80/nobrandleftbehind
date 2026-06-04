/**
 * Scout Pipeline — Own Site Rank Tracking
 *
 * Captures ranking snapshots for all tracked keywords across one or more
 * search locations, calculates position changes vs the previous snapshot
 * (per location), and creates Scout alerts for significant movements.
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

// Short labels for alert text when tracking multiple markets.
const LOCATION_LABELS: Record<number, string> = {
  2826: 'UK',
  2840: 'US',
  2372: 'IE',
  2036: 'AU',
  2124: 'CA',
  2554: 'NZ',
  2276: 'DE',
  2250: 'FR',
  2724: 'ES',
  2380: 'IT',
  2528: 'NL',
}

function emptySummary(tracked = 0): RankSnapshotSummary {
  return { tracked, improved: 0, declined: 0, enteredTop10: 0, droppedFromTop10: 0, biggestMover: null }
}

/**
 * Capture rank snapshots for the given locations. Accepts a single code or an
 * array; returns an aggregated summary across all locations.
 */
export async function captureRankSnapshot(
  tenantId: string,
  domain: string,
  alertThreshold = 5,
  locationCodes: number | number[] = 2826,
): Promise<RankSnapshotSummary> {
  const db = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const locations = Array.from(
    new Set((Array.isArray(locationCodes) ? locationCodes : [locationCodes]).filter((c) => Number.isFinite(c))),
  )
  if (!locations.length) locations.push(2826)
  const multi = locations.length > 1

  // Shared, location-independent keyword set: tracked opportunities.
  const { data: opps } = await db
    .from('scout_keyword_opportunities')
    .select('keyword')
    .eq('tenant_id', tenantId)
    .neq('status', 'dismissed')
  const oppKeywords = new Set((opps ?? []).map((o) => o.keyword.toLowerCase()))

  const aggregate = emptySummary()
  let maxTracked = 0

  for (const locationCode of locations) {
    const locSummary = await captureForLocation(
      db,
      tenantId,
      domain,
      locationCode,
      alertThreshold,
      oppKeywords,
      today,
      multi,
    )
    aggregate.improved += locSummary.improved
    aggregate.declined += locSummary.declined
    aggregate.enteredTop10 += locSummary.enteredTop10
    aggregate.droppedFromTop10 += locSummary.droppedFromTop10
    maxTracked = Math.max(maxTracked, locSummary.tracked)
    if (
      locSummary.biggestMover &&
      (!aggregate.biggestMover || locSummary.biggestMover.change > aggregate.biggestMover.change)
    ) {
      aggregate.biggestMover = locSummary.biggestMover
    }
  }

  aggregate.tracked = maxTracked
  return aggregate
}

async function captureForLocation(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  domain: string,
  locationCode: number,
  alertThreshold: number,
  oppKeywords: Set<string>,
  today: string,
  multi: boolean,
): Promise<RankSnapshotSummary> {
  const locTag = multi ? ` (${LOCATION_LABELS[locationCode] ?? locationCode})` : ''

  const rankingsLive = await getDomainRankSnapshot(domain, locationCode, 100)
  const liveByKeyword = new Map(rankingsLive.map((r) => [r.keyword.toLowerCase(), r]))

  const allKeywords = new Set<string>([
    ...Array.from(oppKeywords),
    ...rankingsLive.map((r) => r.keyword.toLowerCase()),
  ])
  const keywords = Array.from(allKeywords).slice(0, 100)

  // Previous snapshots for THIS location only.
  const { data: prevSnapshots } = await db
    .from('scout_rank_history')
    .select('keyword, position, snapshot_date')
    .eq('tenant_id', tenantId)
    .eq('location_code', locationCode)
    .in('keyword', keywords)
    .order('snapshot_date', { ascending: false })

  const prevByKeyword = new Map<string, number | null>()
  for (const snap of prevSnapshots ?? []) {
    if (!prevByKeyword.has(snap.keyword)) prevByKeyword.set(snap.keyword, snap.position)
  }

  const inserts: Array<{
    tenant_id: string
    keyword: string
    location_code: number
    snapshot_date: string
    position: number | null
    previous_position: number | null
    position_change: number | null
    url: string | null
    search_volume: number | null
    source: string
  }> = []

  const summary = emptySummary(keywords.length)
  const alerts: Array<{ tenant_id: string; alert_type: string; severity: string; title: string; detail: string }> = []

  for (const kw of keywords) {
    const live = liveByKeyword.get(kw)
    const currentPos = live?.position ?? null
    const prevPos = prevByKeyword.get(kw) ?? null
    const change = currentPos !== null && prevPos !== null ? prevPos - currentPos : null // positive = improvement

    inserts.push({
      tenant_id: tenantId,
      keyword: kw,
      location_code: locationCode,
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

    if (currentPos !== null && currentPos <= 10 && (prevPos === null || prevPos > 10)) {
      summary.enteredTop10++
      alerts.push({
        tenant_id: tenantId,
        alert_type: 'rank_entered_top10',
        severity: 'watch',
        title: `"${kw}" entered the top 10${locTag}`,
        detail: `Now ranking at position ${currentPos}${prevPos ? ` (was ${prevPos})` : ''}.`,
      })
    }

    if (prevPos !== null && prevPos <= 10 && currentPos !== null && currentPos > 10) {
      summary.droppedFromTop10++
      alerts.push({
        tenant_id: tenantId,
        alert_type: 'rank_dropped_top10',
        severity: 'urgent',
        title: `"${kw}" dropped out of top 10${locTag}`,
        detail: `Now at position ${currentPos} (was ${prevPos}).`,
      })
    }

    if (change !== null && change > alertThreshold) {
      alerts.push({
        tenant_id: tenantId,
        alert_type: 'rank_improvement',
        severity: 'watch',
        title: `"${kw}" jumped ${change} places${locTag}`,
        detail: `Now position ${currentPos} (was ${prevPos}).`,
      })
    }

    if (change !== null && change < -alertThreshold) {
      alerts.push({
        tenant_id: tenantId,
        alert_type: 'rank_decline',
        severity: 'watch',
        title: `"${kw}" dropped ${Math.abs(change)} places${locTag}`,
        detail: `Now position ${currentPos} (was ${prevPos}).`,
      })
    }
  }

  if (inserts.length) {
    await db
      .from('scout_rank_history')
      .upsert(inserts, { onConflict: 'tenant_id,keyword,snapshot_date,location_code', ignoreDuplicates: true })
  }

  for (const alert of alerts) {
    await db.from('scout_alerts').insert(alert).select().maybeSingle()
  }

  return summary
}
