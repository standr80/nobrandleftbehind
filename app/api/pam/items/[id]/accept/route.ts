import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

interface Params {
  params: Promise<{ id: string }>
}

// POST — accept a recommendation: hand it to Clem via the suggestions
// pipeline (exactly how Scout does it), storing suggestion_id on the item.
// Gallery-type items don't come here — the UI links to Bailey instead.
// Body: { tenantId }.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const db = createAdminClient()
  const { data: item } = await db
    .from('pam_items')
    .select('id, kind, item_type, title, note, reason, evidence, suggestion_id, target_post_id, status')
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .single()

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  if (item.suggestion_id) {
    return NextResponse.json({ error: 'Already sent to Clem' }, { status: 409 })
  }
  if (!['post', 'faq', 'refresh'].includes(item.item_type)) {
    return NextResponse.json(
      { error: 'Only post, FAQ and refresh items hand off to Clem — galleries go to Bailey' },
      { status: 400 },
    )
  }

  const evidence = (item.evidence ?? {}) as { signal?: string; keyword?: string }
  const rationaleParts = [item.reason, item.note].filter(Boolean)
  if (item.item_type === 'refresh' && item.target_post_id) {
    rationaleParts.push(`Refresh of existing post ${item.target_post_id}.`)
  }

  const { data: suggestion, error: sugErr } = await db
    .from('suggestions')
    .insert({
      tenant_id: workspace.tenantId,
      proposed_title: item.title.replace(/^Refresh: /, ''),
      rationale: rationaleParts.join(' ') || 'Planned via Pam.',
      target_keywords: evidence.keyword ? [evidence.keyword] : null,
      source: 'pam',
      source_type: evidence.signal ?? item.item_type,
      status: 'pending',
      content_type: item.item_type === 'faq' ? 'faq' : 'blog',
    })
    .select('id')
    .single()

  if (sugErr || !suggestion) {
    return NextResponse.json({ error: sugErr?.message ?? 'Could not create suggestion' }, { status: 500 })
  }

  const { data: updated, error: updErr } = await db
    .from('pam_items')
    .update({ suggestion_id: suggestion.id, updated_at: new Date().toISOString() })
    .eq('id', item.id)
    .select(
      'id, kind, item_type, title, note, reason, evidence, status, scheduled_for, snoozed_until, source, target_post_id, suggestion_id, created_at, updated_at',
    )
    .single()

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: updated })
}
