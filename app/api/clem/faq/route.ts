import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runFaqDraft, type FaqDraftInput } from '@/lib/clem/faq'
import { aiErrorResponse } from '@/lib/anthropic'

// Claude synthesis of a multi-question FAQ page can take a little while.
export const maxDuration = 120

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as { tenantId?: string } & FaqDraftInput
  const { tenantId, ...input } = body
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  try {
    const postId = await runFaqDraft(tenantId, input)
    return NextResponse.json({ ok: true, postId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/clem/faq]', message)
    const { error, status } = aiErrorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
