import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH — update a question's status ('open' | 'dismissed'). Scoped to the workspace.
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const { id } = await params
  const { status } = (await request.json()) as { status?: string }
  if (status !== 'open' && status !== 'dismissed') {
    return NextResponse.json({ error: 'status must be open or dismissed' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db
    .from('faq_questions')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a question. Scoped to the workspace.
export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const { id } = await params
  const db = createAdminClient()
  const { error } = await db
    .from('faq_questions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', workspace.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
