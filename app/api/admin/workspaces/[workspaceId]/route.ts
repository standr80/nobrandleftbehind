import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

interface Params {
  params: Promise<{ workspaceId: string }>
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
