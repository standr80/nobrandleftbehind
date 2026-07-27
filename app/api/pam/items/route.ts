import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace, resolveMutationWorkspace } from '@/lib/workspace/active'

const ITEM_COLUMNS =
  'id, kind, item_type, title, note, reason, evidence, status, scheduled_for, snoozed_until, source, target_post_id, suggestion_id, created_at, updated_at'

// GET — list the active workspace's Pam items (ideas + recommendations).
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const db = createAdminClient()
  const { data, error } = await db
    .from('pam_items')
    .select(ITEM_COLUMNS)
    .eq('tenant_id', workspace.tenantId)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST — quick-capture an idea. Body: { tenantId, title, note?, item_type?, scheduled_for? }.
// Deliberately loose: a title is enough; structure comes later when acting.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const title = String(body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'An idea needs at least a title' }, { status: 400 })

  const VALID_TYPES = ['post', 'faq', 'gallery', 'refresh', 'other']
  const itemType = VALID_TYPES.includes(body.item_type) ? body.item_type : 'other'
  const scheduledFor =
    typeof body.scheduled_for === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.scheduled_for)
      ? body.scheduled_for
      : null

  const db = createAdminClient()
  const { data, error } = await db
    .from('pam_items')
    .insert({
      tenant_id: workspace.tenantId,
      kind: 'idea',
      source: 'manual',
      item_type: itemType,
      title,
      note: String(body.note ?? '').trim() || null,
      scheduled_for: scheduledFor,
      status: scheduledFor ? 'scheduled' : 'open',
      created_by: userId,
    })
    .select(ITEM_COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}
