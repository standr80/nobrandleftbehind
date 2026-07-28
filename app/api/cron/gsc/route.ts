import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTenantGsc } from '@/lib/gsc/sync'

export const maxDuration = 300

/**
 * Vercel Cron — weekly GSC sync for every tenant with a property configured
 * (Monday 05:00 UTC, before Scout's weekly at 06:00 and Pam's run on
 * Tuesday, so both see fresh data). Protected by CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: configs, error } = await db
    .from('scout_config')
    .select('tenant_id, gsc_property_id')
    .not('gsc_property_id', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Record<string, unknown> = {}
  for (const config of configs ?? []) {
    try {
      results[config.tenant_id] = await syncTenantGsc(config.tenant_id)
    } catch (err) {
      console.error('[gsc cron] failed for tenant', config.tenant_id, err)
      results[config.tenant_id] = { error: err instanceof Error ? err.message : 'failed' }
    }
  }

  return NextResponse.json({ ok: true, results })
}
