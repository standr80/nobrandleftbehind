import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runFaqDraft, type FaqDraftInput } from '@/lib/clem/faq'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { aiErrorResponse } from '@/lib/anthropic'

// Claude synthesis of a multi-question FAQ page can take a little while.
export const maxDuration = 120

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve against the workspace the page was loaded with (client-supplied),
  // verifying membership — not the shared active-workspace cookie.
  const input = (await request.json()) as FaqDraftInput & { tenantId?: string }
  const workspace = await resolveMutationWorkspace(userId, input.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

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
