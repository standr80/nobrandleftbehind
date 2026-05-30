import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const db = createAdminClient()

  // Get the most recent snapshot date
  const { data: dates } = await db
    .from('scout_rank_history')
    .select('snapshot_date')
    .eq('tenant_id', workspace.tenantId)
    .order('snapshot_date', { ascending: false })
    .limit(1)

  const latestDate = dates?.[0]?.snapshot_date
  if (!latestDate) return NextResponse.json({ rows: [], summary: null })

  const { data: rows } = await db
    .from('scout_rank_history')
    .select('keyword, position, previous_position, position_change, url, search_volume, snapshot_date')
    .eq('tenant_id', workspace.tenantId)
    .eq('snapshot_date', latestDate)
    .order('position', { ascending: true, nullsFirst: false })
    .limit(100)

  const validRows = rows ?? []
  const summary = {
    improved: validRows.filter((r) => (r.position_change ?? 0) > 0).length,
    declined: validRows.filter((r) => (r.position_change ?? 0) < 0).length,
    enteredTop10: validRows.filter(
      (r) => r.position !== null && r.position <= 10 &&
        (r.previous_position === null || r.previous_position > 10)
    ).length,
    snapshotDate: latestDate,
  }

  // Per-keyword position history for sparklines — last 12 snapshots, oldest first.
  const { data: distinctDates } = await db
    .from('scout_rank_history')
    .select('snapshot_date')
    .eq('tenant_id', workspace.tenantId)
    .order('snapshot_date', { ascending: false })

  const recentDates = Array.from(new Set((distinctDates ?? []).map((d) => d.snapshot_date)))
    .slice(0, 12)
    .reverse()

  const history: Record<string, { date: string; position: number | null }[]> = {}
  if (recentDates.length > 1) {
    const { data: histRows } = await db
      .from('scout_rank_history')
      .select('keyword, position, snapshot_date')
      .eq('tenant_id', workspace.tenantId)
      .in('snapshot_date', recentDates)

    for (const r of histRows ?? []) {
      ;(history[r.keyword] ??= []).push({ date: r.snapshot_date, position: r.position })
    }
    for (const kw of Object.keys(history)) {
      history[kw].sort((a, b) => a.date.localeCompare(b.date))
    }
  }

  return NextResponse.json({ rows: validRows, summary, history })
}
