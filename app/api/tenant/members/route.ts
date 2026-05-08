import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — add a member to the current user's tenant
// Accepts either clerk_user_id directly or an email address to look up
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: membership } = await db
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
  if (membership.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { clerk_user_id, email, role } = await request.json()

  if (!role || !['admin', 'author', 'reviewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin, author, or reviewer' }, { status: 400 })
  }

  let targetClerkId: string = clerk_user_id
  let targetEmail: string | null = email ?? null
  let targetName: string | null = null

  // If email was provided instead of a Clerk ID, look the user up
  if (!targetClerkId && email) {
    try {
      const clerk = await clerkClient()
      const users = await clerk.users.getUserList({ emailAddress: [email] })
      if (!users.data.length) {
        return NextResponse.json(
          { error: `No Clem account found for ${email}. They must sign up first.` },
          { status: 404 },
        )
      }
      const found = users.data[0]
      targetClerkId = found.id
      targetEmail = found.emailAddresses[0]?.emailAddress ?? email
      targetName = [found.firstName, found.lastName].filter(Boolean).join(' ') || null
    } catch {
      return NextResponse.json({ error: 'Failed to look up user in Clerk' }, { status: 500 })
    }
  }

  if (!targetClerkId) {
    return NextResponse.json({ error: 'clerk_user_id or email is required' }, { status: 400 })
  }

  // Check not already a member
  const { data: existing } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', membership.tenant_id)
    .eq('clerk_user_id', targetClerkId)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 })

  const { data: newMember, error } = await db
    .from('tenant_members')
    .insert({
      tenant_id: membership.tenant_id,
      clerk_user_id: targetClerkId,
      role,
      email: targetEmail,
      name: targetName,
    })
    .select('id, clerk_user_id, role, email, name, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, member: newMember })
}

// DELETE — remove a member from the current user's tenant
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: membership } = await db
    .from('tenant_members')
    .select('tenant_id, role, id')
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'No tenant found' }, { status: 404 })
  if (membership.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // Prevent removing yourself
  if (memberId === membership.id) {
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
  }

  const { error } = await db
    .from('tenant_members')
    .delete()
    .eq('id', memberId)
    .eq('tenant_id', membership.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
