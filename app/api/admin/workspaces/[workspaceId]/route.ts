import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

interface Params {
  params: Promise<{ workspaceId: string }>
}

// PATCH /api/admin/workspaces/[workspaceId] — superadmin: set per-workspace
// site limits (billing lever) { max_competitor_sites?, max_reference_sites? }
export async function PATCH(request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ADMIN_ID || userId !== PLATFORM_ADMIN_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspaceId } = await params
  const body = await request.json()

  const updates: { max_competitor_sites?: number; max_reference_sites?: number } = {}
  for (const key of ['max_competitor_sites', 'max_reference_sites'] as const) {
    if (key in body) {
      const value = Number(body[key])
      if (!Number.isInteger(value) || value < 0 || value > 1000) {
        return NextResponse.json({ error: `${key} must be an integer between 0 and 1000` }, { status: 400 })
      }
      updates[key] = value
    }
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const db = createAdminClient()
  const { error } = await db.from('tenants').update(updates).eq('id', workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/workspaces/[workspaceId] — permanently delete a workspace
export async function DELETE(_request: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!PLATFORM_ADMIN_ID || userId !== PLATFORM_ADMIN_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspaceId } = await params
  const db = createAdminClient()

  // Cascade deletes are handled by FK constraints (blog_posts, suggestions, tenant_members, etc.)
  const { error } = await db.from('tenants').delete().eq('id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
