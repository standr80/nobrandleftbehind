import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { getHistoricalRankings } from '@/lib/integrations/dataforseo/client'

/**
 * Backfills a keyword's rank trend from DataForSEO Historical SERPs so the
 * sparkline shows real history immediately. One DataForSEO request per call.
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { keyword, location, device } = (await request.json()) as {
    keyword?: string
    location?: number
    device?: string
  }
  if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 })

  const db = createAdminClient()
  const tenantId = workspace.tenantId

  const { data: tenant } = await db.from('tenants').select('domain').eq('id', tenantId).single()
  if (!tenant?.domain) return NextResponse.json({ error: 'Tenant domain not set' }, { status: 400 })

  const locationCode = Number.isFinite(location) ? Number(location) : 2826
  const dev = device === 'mobile' ? 'mobile' : 'desktop'

  let points
  try {
    points = await getHistoricalRankings(keyword.toLowerCase(), tenant.domain, locationCode, dev)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Historical lookup failed' },
      { status: 502 },
    )
  }

  if (!points.length) return NextResponse.json({ added: 0 })

  // Build rows with sequential previous-position / change.
  let prev: number | null = null
  const rows = points.map((p) => {
    const change = p.position !== null && prev !== null ? prev - p.position : null
    const row = {
      tenant_id: tenantId,
      keyword: keyword.toLowerCase(),
      location_code: locationCode,
      device: dev,
      snapshot_date: p.date,
      position: p.position,
      previous_position: prev,
      position_change: change,
      url: p.url,
      search_volume: null as number | null,
      source: 'historical',
    }
    if (p.position !== null) prev = p.position
    return row
  })

  // Don't clobber real weekly snapshots if a date happens to collide.
  const { error } = await db
    .from('scout_rank_history')
    .upsert(rows, { onConflict: 'tenant_id,keyword,snapshot_date,location_code,device', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ added: rows.length })
}
