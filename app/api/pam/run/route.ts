import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { runPamEngine } from '@/lib/pam/engine'

export const maxDuration = 60

// POST — run Pam's engine on demand for the active workspace and return the
// refreshed item list. Body: { tenantId }.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  try {
    const result = await runPamEngine(workspace.tenantId)
    const db = createAdminClient()
    const { data: items } = await db
      .from('pam_items')
      .select(
        'id, kind, item_type, title, note, reason, evidence, status, scheduled_for, snoozed_until, source, target_post_id, suggestion_id, created_at, updated_at',
      )
      .eq('tenant_id', workspace.tenantId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false })
    return NextResponse.json({ ok: true, ...result, items: items ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Pam run failed' },
      { status: 500 },
    )
  }
}
