import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWorkspaceInvite } from '@/lib/email/send'
import { randomUUID } from 'crypto'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

// POST /api/admin/workspaces — platform admin only: create a new workspace
// Accepts: { name, domain, adminEmail, brand_voice?, publish_cadence? }
// If the adminEmail maps to an existing Clerk user, adds them directly.
// If not, sends an invite and they'll be added on accept.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ADMIN_ID || userId !== PLATFORM_ADMIN_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, domain, adminEmail, brand_voice, publish_cadence } = await request.json()

  if (!name?.trim() || !domain?.trim() || !adminEmail?.trim()) {
    return NextResponse.json({ error: 'name, domain and adminEmail are required' }, { status: 400 })
  }

  const db = createAdminClient()

  // Create the workspace
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .insert({
      name: name.trim(),
      domain: domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      brand_voice: brand_voice ?? null,
      publish_cadence: publish_cadence ?? '2pw',
      billing_tier: 'starter',
    })
    .select('id, name, domain')
    .single()

  if (tenantErr) return NextResponse.json({ error: tenantErr.message }, { status: 500 })

  // Try to find existing Clerk user by email
  let targetClerkId: string | null = null
  let targetName: string | null = null
  try {
    const clerk = await clerkClient()
    const users = await clerk.users.getUserList({ emailAddress: [adminEmail] })
    if (users.data.length > 0) {
      const found = users.data[0]
      targetClerkId = found.id
      targetName = [found.firstName, found.lastName].filter(Boolean).join(' ') || null
    }
  } catch {
    // Non-fatal — fall through to invite
  }

  let invited = false

  if (targetClerkId) {
    // Add directly as admin
    await db.from('tenant_members').insert({
      tenant_id: tenant.id,
      clerk_user_id: targetClerkId,
      role: 'admin',
      email: adminEmail.toLowerCase().trim(),
      name: targetName,
    })
  } else {
    // Send invite
    const token = randomUUID()
    await db.from('workspace_invitations').insert({
      tenant_id: tenant.id,
      email: adminEmail.toLowerCase().trim(),
      role: 'admin',
      token,
      invited_by: null,
    })

    try {
      await sendWorkspaceInvite({
        to: adminEmail,
        inviterName: 'Clem Platform Admin',
        workspaceName: tenant.name,
        workspaceDomain: tenant.domain,
        role: 'admin',
        token,
      })
    } catch (err) {
      console.error('[/api/admin/workspaces] Failed to send invite email:', err)
    }

    invited = true
  }

  return NextResponse.json({ ok: true, tenantId: tenant.id, invited })
}
