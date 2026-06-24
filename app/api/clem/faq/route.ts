import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runFaqDraft, type FaqDraftInput } from '@/lib/clem/faq'
import { getActiveWorkspace } from '@/lib/workspace/active'
import { aiErrorResponse } from '@/lib/anthropic'

// Claude synthesis of a multi-question FAQ page can take a little while.
export const maxDuration = 120

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Act on the caller's active workspace (don't trust a tenantId from the body).
  const workspace = await getActiveWorkspace(userId)
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  // Any tenantId on the body is ignored; runFaqDraft uses the resolved workspace.
  const input = (await request.json()) as FaqDraftInput

  try {
    const postId = await runFaqDraft(workspace.tenantId, input)
    return NextResponse.json({ ok: true, postId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/clem/faq]', message)
    const { error, status } = aiErrorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
