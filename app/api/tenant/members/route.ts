import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveMutationWorkspace } from '@/lib/workspace/active'

// POST — send a workspace invite (replaces direct add)
// Handled now by /api/invite — kept for direct add by clerk_user_id (internal use)
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { clerk_user_id, role, tenantId } = await request.json()
  const workspace = await resolveMutationWorkspace(userId, tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  if (!clerk_user_id) return NextResponse.json({ error: 'clerk_user_id is required' }, { status: 400 })
  if (!role || !['admin', 'author', 'reviewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin, author, or reviewer' }, { status: 400 })
  }

  // Check not already a member
  const { data: existing } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', workspace.tenantId)
    .eq('clerk_user_id', clerk_user_id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 })

  const { data: newMember, error } = await db
    .from('tenant_members')
    .insert({
      tenant_id: workspace.tenantId,
      clerk_user_id,
      role,
    })
    .select('id, clerk_user_id, role, email, name, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, member: newMember })
}

// DELETE — remove a member from the active workspace
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId, tenantId } = await request.json()
  const workspace = await resolveMutationWorkspace(userId, tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const db = createAdminClient()

  // Get the current user's membership row ID so we can prevent self-removal
  const { data: myMembership } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', workspace.tenantId)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  if (memberId === myMembership?.id) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
  }

  const { error } = await db
    .from('tenant_members')
    .delete()
    .eq('id', memberId)
    .eq('tenant_id', workspace.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
