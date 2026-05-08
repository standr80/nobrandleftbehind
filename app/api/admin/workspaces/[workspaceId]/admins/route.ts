import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWorkspaceInvite } from '@/lib/email/send'
import { randomUUID } from 'crypto'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

interface Params {
  params: Promise<{ workspaceId: string }>
}

// POST /api/admin/workspaces/[workspaceId]/admins
// Add or invite an admin to a workspace (platform superadmin only).
// If the email matches an existing Clerk user → add directly as admin.
// If not → send an invite with role=admin.
export async function POST(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ADMIN_ID || userId !== PLATFORM_ADMIN_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspaceId } = await params
  const { email } = await request.json()

  if (!email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const db = createAdminClient()

  // Look up workspace
  const { data: workspace } = await db
    .from('tenants')
    .select('id, name, domain')
    .eq('id', workspaceId)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  // Try to find an existing Clerk user by email
  let targetClerkId: string | null = null
  let targetName: string | null = null
  let targetEmail = email.toLowerCase().trim()

  try {
    const clerk = await clerkClient()
    const users = await clerk.users.getUserList({ emailAddress: [targetEmail] })
    if (users.data.length > 0) {
      const found = users.data[0]
      targetClerkId = found.id
      targetName = [found.firstName, found.lastName].filter(Boolean).join(' ') || null
      targetEmail = found.emailAddresses[0]?.emailAddress ?? targetEmail
    }
  } catch { /* non-critical */ }

  if (targetClerkId) {
    // Check if already a member
    const { data: existing } = await db
      .from('tenant_members')
      .select('id, role')
      .eq('tenant_id', workspaceId)
      .eq('clerk_user_id', targetClerkId)
      .maybeSingle()

    if (existing) {
      if (existing.role === 'admin') {
        return NextResponse.json({ error: 'This person is already an admin of this workspace' }, { status: 409 })
      }
      // Upgrade to admin
      await db.from('tenant_members').update({ role: 'admin' }).eq('id', existing.id)
      const { data: updated } = await db
        .from('tenant_members')
        .select('id, tenant_id, name, email, role, clerk_user_id, created_at')
        .eq('id', existing.id)
        .single()
      return NextResponse.json({ ok: true, invited: false, member: updated })
    }

    // Add as new admin member
    const { data: newMember, error } = await db
      .from('tenant_members')
      .insert({
        tenant_id: workspaceId,
        clerk_user_id: targetClerkId,
        role: 'admin',
        email: targetEmail,
        name: targetName,
      })
      .select('id, tenant_id, name, email, role, clerk_user_id, created_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, invited: false, member: newMember })
  }

  // No Clerk account — send invite
  // Check for existing active invite
  const { data: existingInvite } = await db
    .from('workspace_invitations')
    .select('id, token')
    .eq('tenant_id', workspaceId)
    .eq('email', targetEmail)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  let token: string
  if (existingInvite) {
    token = existingInvite.token
  } else {
    token = randomUUID()
    await db.from('workspace_invitations').insert({
      tenant_id: workspaceId,
      email: targetEmail,
      role: 'admin',
      token,
      invited_by: null,
    })
  }

  const inviteUrl = `${APP_URL}/invite/${token}`

  try {
    await sendWorkspaceInvite({
      to: targetEmail,
      inviterName: 'Clem Platform Admin',
      workspaceName: workspace.name,
      workspaceDomain: workspace.domain,
      role: 'admin',
      token,
    })
  } catch (err) {
    console.error('[/api/admin/workspaces/admins] Email failed:', err)
  }

  return NextResponse.json({ ok: true, invited: true, inviteUrl })
}
