import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/workspace/active'

interface Params {
  params: Promise<{ token: string }>
}

// POST /api/invite/[token] — accept a workspace invitation
export async function POST(_request: Request, { params }: Params) {
  const { token } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  // Look up the invitation
  const { data: invite } = await db
    .from('workspace_invitations')
    .select('id, tenant_id, email, role, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Invite not found or already used' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  // Verify the signed-in user's email matches the invite
  try {
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(userId)
    const userEmails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase())
    if (!userEmails.includes(invite.email.toLowerCase())) {
      return NextResponse.json(
        { error: `This invite was sent to ${invite.email}. Please sign in with that email address.` },
        { status: 403 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'Failed to verify user email' }, { status: 500 })
  }

  // Check not already a member
  const { data: existing } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', invite.tenant_id)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!existing) {
    // Get user info from Clerk for the member row
    let memberEmail: string | null = invite.email
    let memberName: string | null = null
    try {
      const clerk = await clerkClient()
      const user = await clerk.users.getUser(userId)
      memberEmail = user.emailAddresses[0]?.emailAddress ?? invite.email
      memberName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null
    } catch { /* non-critical */ }

    const { error: memberError } = await db.from('tenant_members').insert({
      tenant_id: invite.tenant_id,
      clerk_user_id: userId,
      role: invite.role,
      email: memberEmail,
      name: memberName,
    })

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Mark invite as accepted
  await db
    .from('workspace_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  // Return the tenantId so the page can set the active workspace cookie
  const response = NextResponse.json({ ok: true, tenantId: invite.tenant_id })
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, invite.tenant_id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return response
}
