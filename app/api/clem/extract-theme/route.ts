import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { extractTheme } from '@/lib/clem/extractTheme'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { aiErrorResponse } from '@/lib/anthropic'

const PLATFORM_ADMIN_ID = process.env.PLATFORM_ADMIN_CLERK_USER_ID

// POST /api/clem/extract-theme
// Admin-only: scrapes the tenant's homepage and extracts brand design tokens.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  // Only platform admin or workspace admins can trigger this
  const isAdmin = userId === PLATFORM_ADMIN_ID || workspace.role === 'admin'
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await request.json()
  const targetId = body.tenantId ?? workspace.tenantId
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
