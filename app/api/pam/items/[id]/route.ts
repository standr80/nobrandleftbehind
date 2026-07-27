import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

interface Params {
  params: Promise<{ id: string }>
}

const ITEM_COLUMNS =
  'id, kind, item_type, title, note, reason, evidence, status, scheduled_for, snoozed_until, source, target_post_id, suggestion_id, created_at, updated_at'

// PATCH — update an item. Body: { tenantId, title?, note?, item_type?,
// scheduled_for? (date or null), status? ('open'|'scheduled'|'done'|'dismissed'|'snoozed'),
// snoozed_until? }.
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const patch: {
    title?: string
    note?: string | null
    item_type?: string
    scheduled_for?: string | null
    snoozed_until?: string | null
    status?: string
    dismissed_at?: string | null
    done_at?: string | null
    updated_at?: string
  } = {}

  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim()
  if (typeof body.note === 'string') patch.note = body.note.trim() || null

  const VALID_TYPES = ['post', 'faq', 'gallery', 'refresh', 'other']
  if (VALID_TYPES.includes(body.item_type)) patch.item_type = body.item_type

  const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  if ('scheduled_for' in body) {
    if (isDate(body.scheduled_for)) {
      patch.scheduled_for = body.scheduled_for
      patch.status = 'scheduled'
    } else if (body.scheduled_for === null) {
      patch.scheduled_for = null
      patch.status = 'open'
    }
  }
  if (isDate(body.snoozed_until)) {
    patch.snoozed_until = body.snoozed_until
    patch.status = 'snoozed'
  }

  const VALID_STATUSES = ['open', 'scheduled', 'done', 'dismissed', 'snoozed']
  if (VALID_STATUSES.includes(body.status)) {
    patch.status = body.status
    if (body.status === 'dismissed') patch.dismissed_at = new Date().toISOString()
    if (body.status === 'done') patch.done_at = new Date().toISOString()
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  patch.updated_at = new Date().toISOString()

  const db = createAdminClient()
  const { data, error } = await db
    .from('pam_items')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .select(ITEM_COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

// DELETE — remove an item outright (manual ideas; recommendations should be
// dismissed instead so the engine remembers them). Body: { tenantId }.
export async function DELETE(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const db = createAdminClient()
  const { error } = await db
    .from('pam_items')
    .delete()
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .eq('source', 'manual') // recommendations are dismissed, never deleted
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
