/**
 * GET /api/scout/alerts/check
 * Daily alert check — emails urgent unactioned alerts to tenant admins.
 * Called by Vercel Cron — protected by CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import { runDailyAlertCheck } from '@/lib/scout/alerts'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runDailyAlertCheck()

  return NextResponse.json(result)
}
