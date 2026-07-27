import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runPamEngine } from '@/lib/pam/engine'

export const maxDuration = 300

/**
 * Vercel Cron — weekly Pam run across all tenants (Tuesday 06:00 UTC).
 * Generates fresh recommendations per workspace; per-tenant failures are
 * logged and never block the sweep. Protected by CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: tenants, error } = await db.from('tenants').select('id, name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Record<string, unknown> = {}
  for (const tenant of tenants ?? []) {
    try {
      results[tenant.name ?? tenant.id] = await runPamEngine(tenant.id)
    } catch (err) {
      console.error('[pam cron] failed for tenant', tenant.id, err)
      results[tenant.name ?? tenant.id] = { error: err instanceof Error ? err.message : 'failed' }
    }
  }

  return NextResponse.json({ ok: true, results })
}
