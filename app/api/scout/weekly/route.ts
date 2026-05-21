/**
 * GET /api/scout/weekly
 * Weekly full run for all Scout-enabled tenants.
 * Called by Vercel Cron — protected by CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import { runScoutForAllTenants } from '@/lib/scout/schedule'

export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await runScoutForAllTenants()

  const summary = {
    ran: results.length,
    succeeded: results.filter((r) => !r.error).length,
    failed: results.filter((r) => !!r.error).length,
    errors: results.filter((r) => r.error).map((r) => ({ tenantId: r.tenantId, error: r.error })),
  }

  return NextResponse.json(summary)
}
