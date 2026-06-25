/**
 * POST /api/scout/run
 * Manual trigger for a full Scout run on the current tenant.
 * Admin only.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { runScoutForTenant } from '@/lib/scout/schedule'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { tenantId } = await request.json().catch(() => ({}))
    const workspace = await resolveMutationWorkspace(userId, tenantId)
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

    const result = await runScoutForTenant(workspace.tenantId)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ briefingId: result.briefingId })
  } catch (err) {
    // Any uncaught throw here would otherwise return a non-JSON 500, which the
    // client surfaces as an opaque "Network error". Return the real message so
    // it's visible in the UI and the logs.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/scout/run] unhandled error:', message)
    return NextResponse.json({ error: `Scout run failed: ${message}` }, { status: 500 })
  }
}
