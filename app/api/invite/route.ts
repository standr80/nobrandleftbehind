import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { sendWorkspaceInvite } from '@/lib/email/send'
import { randomUUID } from 'crypto'

// POST /api/invite — send a workspace invitation email
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { email, role } = await request.json()

  if (!email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!role || !['admin', 'author', 'reviewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin, author, or reviewer' }, { status: 400 })
  }

  const db = createAdminClient()

  // Get inviter's name from Clerk
  let inviterName = 'A workspace admin'
  try {
    const clerk = await clerkClient()
    const inviter = await clerk.users.getUser(userId)
    inviterName = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviterName
  } catch { /* non-critical */ }

  // Check if already a member
  const { data: existingMember } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', workspace.tenantId)
    .eq('clerk_user_id', (
      // Try to look up Clerk user by email for the membership check
      await (async () => {
        try {
          const clerk = await clerkClient()
          const users = await clerk.users.getUserList({ emailAddress: [email] })
          return users.data[0]?.id ?? 'no-match'
        } catch {
          return 'no-match'
        }
      })()
    ))
    .maybeSingle()

  if (existingMember) {
    return NextResponse.json({ error: 'This person is already a member of this workspace' }, { status: 409 })
  }

  // Check for an active (unexpired, unaccepted) invite for this email+workspace
  const { data: activeInvite } = await db
    .from('workspace_invitations')
    .select('id')
    .eq('tenant_id', workspace.tenantId)
    .eq('email', email.toLowerCase().trim())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (activeInvite) {
    return NextResponse.json({ error: 'An active invite already exists for this email address' }, { status: 409 })
  }

  // Get the inviter's tenant_member row ID
  const { data: myMembership } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', workspace.tenantId)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  const token = randomUUID()

  const { error: insertError } = await db.from('workspace_invitations').insert({
    tenant_id: workspace.tenantId,
    email: email.toLowerCase().trim(),
    role,
    token,
    invited_by: myMembership?.id ?? null,
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  try {
    await sendWorkspaceInvite({
      to: email,
      inviterName,
      workspaceName: workspace.tenant.name,
      workspaceDomain: workspace.tenant.domain,
      role,
      token,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/invite] Failed to send email:', message)
    // Don't fail — invite row is created, email failure is non-fatal
  }

  return NextResponse.json({ ok: true })
}
