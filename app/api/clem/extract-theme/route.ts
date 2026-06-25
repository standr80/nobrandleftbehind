import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { extractTheme } from '@/lib/clem/extractTheme'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { aiErrorResponse } from '@/lib/anthropic'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

// POST /api/clem/extract-theme
// Admin-only: scrapes the tenant's homepage and extracts brand design tokens.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // Resolve against the page's workspace; platform admin can act on any tenant.
  const isPlatformAdmin = userId === PLATFORM_ADMIN_ID
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!isPlatformAdmin) {
    if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })
    if (workspace.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const targetId = workspace?.tenantId ?? body.tenantId
  if (!targetId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })
  const overrideUrl: string | undefined = body.url || undefined

  try {
    const theme = await extractTheme(targetId, overrideUrl)
    return NextResponse.json({ ok: true, theme })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/clem/extract-theme]', message)
    const { error, status } = aiErrorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
