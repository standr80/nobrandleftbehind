import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

interface Params {
  params: Promise<{ id: string }>
}

// PATCH — update a question's status ('open' | 'dismissed'). Scoped to the workspace.
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { status, tenantId } = (await request.json()) as { status?: string; tenantId?: string }
  const workspace = await resolveMutationWorkspace(userId, tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
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
export async function DELETE(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requestedTenantId = new URL(request.url).searchParams.get('tenantId')
  const workspace = await resolveMutationWorkspace(userId, requestedTenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

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
