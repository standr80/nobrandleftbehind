/**
 * POST /api/scout/run
 * Manual trigger for a full Scout run on the current tenant.
 * Admin only.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { runScoutForTenant } from '@/lib/scout/schedule'

export const maxDuration = 300

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const result = await runScoutForTenant(workspace.tenantId)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ briefingId: result.briefingId })
}
