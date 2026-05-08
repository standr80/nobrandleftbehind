import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

interface Params {
  params: Promise<{ workspaceId: string; memberId: string }>
}

// PATCH — change a member's role
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ADMIN_ID || userId !== PLATFORM_ADMIN_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspaceId, memberId } = await params
  const { role } = await request.json()

  if (!role || !['admin', 'author', 'reviewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin, author, or reviewer' }, { status: 400 })
  }

  const db = createAdminClient()

  const { error } = await db
    .from('tenant_members')
    .update({ role })
    .eq('id', memberId)
    .eq('tenant_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE — remove a member from a workspace
export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ADMIN_ID || userId !== PLATFORM_ADMIN_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspaceId, memberId } = await params
  const db = createAdminClient()

  const { error } = await db
    .from('tenant_members')
    .delete()
    .eq('id', memberId)
    .eq('tenant_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
