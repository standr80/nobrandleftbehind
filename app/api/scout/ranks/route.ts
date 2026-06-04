import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const db = createAdminClient()
  const tenantId = workspace.tenantId

  // Which locations have rank data? Drives the UI's market toggle.
  const { data: locRows } = await db
    .from('scout_rank_history')
    .select('location_code')
    .eq('tenant_id', tenantId)
  const locations = Array.from(new Set((locRows ?? []).map((r) => r.location_code))).sort(
    (a, b) => a - b,
  )

  if (!locations.length) {
    return NextResponse.json({ rows: [], summary: null, history: {}, locations: [], location: null })
  }

  // Selected location: requested ?location=, else default (UK if present, else first).
  const requested = Number(new URL(request.url).searchParams.get('location'))
  const location =
    locations.includes(requested) ? requested : locations.includes(2826) ? 2826 : locations[0]

  // Most recent snapshot date FOR THIS LOCATION.
  const { data: dates } = await db
    .from('scout_rank_history')
    .select('snapshot_date')
    .eq('tenant_id', tenantId)
    .eq('location_code', location)
    .order('snapshot_date', { ascending: false })
    .limit(1)

  const latestDate = dates?.[0]?.snapshot_date
  if (!latestDate) {
    return NextResponse.json({ rows: [], summary: null, history: {}, locations, location })
  }

  const { data: rows } = await db
    .from('scout_rank_history')
    .select('keyword, position, previous_position, position_change, url, search_volume, snapshot_date')
    .eq('tenant_id', tenantId)
    .eq('location_code', location)
    .eq('snapshot_date', latestDate)
    .order('position', { ascending: true, nullsFirst: false })
    .limit(100)

  const validRows = rows ?? []

  // Visibility metrics over keywords that actually rank (position present).
  const ranking = validRows.filter((r) => r.position !== null) as Array<
    { position: number; url: string | null; search_volume: number | null }
  >
  const rankedKeywords = ranking.length
  const avgPosition = rankedKeywords
    ? Math.round((ranking.reduce((s, r) => s + r.position, 0) / rankedKeywords) * 10) / 10
    : null
  const top3 = ranking.filter((r) => r.position <= 3).length
  const top10 = ranking.filter((r) => r.position <= 10).length
  const rankedPages = new Set(ranking.map((r) => r.url).filter(Boolean)).size

  // Volume-weighted visibility: share of available search demand captured,
  // using approximate organic CTR by position. 100 = everything ranked #1.
  const ctr = (pos: number) => {
    const table = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.015]
    if (pos <= 10) return table[pos - 1]
    if (pos <= 20) return 0.01
    if (pos <= 50) return 0.005
    return 0.001
  }
  const weightDenom = ranking.reduce((s, r) => s + (r.search_volume ?? 0) * ctr(1), 0)
  const weightNumer = ranking.reduce((s, r) => s + (r.search_volume ?? 0) * ctr(r.position), 0)
  const visibilityScore = weightDenom > 0 ? Math.round((weightNumer / weightDenom) * 100) : null

  const summary = {
    improved: validRows.filter((r) => (r.position_change ?? 0) > 0).length,
    declined: validRows.filter((r) => (r.position_change ?? 0) < 0).length,
    enteredTop10: validRows.filter(
      (r) => r.position !== null && r.position <= 10 &&
        (r.previous_position === null || r.previous_position > 10)
    ).length,
    rankedKeywords,
    avgPosition,
    top3,
    top10,
    rankedPages,
    visibilityScore,
    snapshotDate: latestDate,
  }

  // Per-keyword position history for sparklines — last 12 snapshots for this
  // location, oldest first.
  const { data: distinctDates } = await db
    .from('scout_rank_history')
    .select('snapshot_date')
    .eq('tenant_id', tenantId)
    .eq('location_code', location)
    .order('snapshot_date', { ascending: false })

  const recentDates = Array.from(new Set((distinctDates ?? []).map((d) => d.snapshot_date)))
    .slice(0, 12)
    .reverse()

  const history: Record<string, { date: string; position: number | null }[]> = {}
  if (recentDates.length > 1) {
    const { data: histRows } = await db
      .from('scout_rank_history')
      .select('keyword, position, snapshot_date')
      .eq('tenant_id', tenantId)
      .eq('location_code', location)
      .in('snapshot_date', recentDates)

    for (const r of histRows ?? []) {
      ;(history[r.keyword] ??= []).push({ date: r.snapshot_date, position: r.position })
    }
    for (const kw of Object.keys(history)) {
      history[kw].sort((a, b) => a.date.localeCompare(b.date))
    }
  }

  return NextResponse.json({ rows: validRows, summary, history, locations, location })
}
