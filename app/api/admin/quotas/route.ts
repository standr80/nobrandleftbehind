import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

// POST /api/admin/quotas — grant or update a user's workspace creation quota
// Body: { email: string, max_workspaces: number, notes?: string }
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ADMIN_ID || userId !== PLATFORM_ADMIN_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, max_workspaces, notes } = await request.json()

  if (!email?.trim()) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (typeof max_workspaces !== 'number' || max_workspaces < 0) {
    return NextResponse.json({ error: 'max_workspaces must be a non-negative integer' }, { status: 400 })
  }

  // Look up the Clerk user by email
  let targetClerkId: string | null = null
  try {
    const clerk = await clerkClient()
    const users = await clerk.users.getUserList({ emailAddress: [email.toLowerCase().trim()] })
    targetClerkId = users.data[0]?.id ?? null
  } catch {
    return NextResponse.json({ error: 'Failed to look up user in Clerk' }, { status: 500 })
  }

  if (!targetClerkId) {
    return NextResponse.json(
      { error: `No Clem account found for ${email}. They must sign up first, or you can invite them.` },
      { status: 404 },
    )
  }

  const db = createAdminClient()

  // Upsert the quota
  const { data, error } = await db
    .from('workspace_quotas')
    .upsert(
      {
        clerk_user_id: targetClerkId,
        max_workspaces,
        granted_by: userId,
        notes: notes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clerk_user_id' },
    )
    .select('id, clerk_user_id, max_workspaces, notes, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, quota: data })
}

// DELETE /api/admin/quotas — revoke a user's quota (sets max_workspaces to 0)
export async function DELETE(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ADMIN_ID || userId !== PLATFORM_ADMIN_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clerkUserId } = await request.json()
  if (!clerkUserId) return NextResponse.json({ error: 'clerkUserId required' }, { status: 400 })

  const db = createAdminClient()
  await db.from('workspace_quotas').delete().eq('clerk_user_id', clerkUserId)

  return NextResponse.json({ ok: true })
}
