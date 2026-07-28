import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { syncTenantGsc } from '@/lib/gsc/sync'

export const maxDuration = 120

// POST — sync GSC data for the active workspace now. Doubles as the "test
// connection" button: a failed property/permission setup errors clearly.
// Body: { tenantId }.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  try {
    const result = await syncTenantGsc(workspace.tenantId)
    if (result.skipped) return NextResponse.json({ error: result.skipped }, { status: 400 })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'GSC sync failed' },
      { status: 502 },
    )
  }
}
