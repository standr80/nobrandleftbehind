import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

interface Params {
  params: Promise<{ id: string }>
}

// DELETE — remove a topic (its question assignments cascade; the questions
// themselves stay in the pool). Body: { tenantId }.
export async function DELETE(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const db = createAdminClient()
  const { data: topic } = await db
    .from('faq_topics')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
    .maybeSingle()
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const { error } = await db.from('faq_topics').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH — rename a topic. Body: { tenantId, name }.
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'A topic name is required' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db
    .from('faq_topics')
    .update({ name })
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
