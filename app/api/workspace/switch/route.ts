import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/workspace/active'

// POST /api/workspace/switch — set the active workspace cookie
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId } = await request.json()
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  const db = createAdminClient()

  // Verify the user is actually a member of the requested workspace
  const { data: membership } = await db
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('clerk_user_id', userId)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  return response
}
