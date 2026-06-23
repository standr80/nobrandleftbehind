import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runDraft } from '@/lib/clem/draft'
import { aiErrorResponse } from '@/lib/anthropic'

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenantId, suggestionId } = await request.json()
  if (!tenantId || !suggestionId)
    return NextResponse.json({ error: 'tenantId and suggestionId required' }, { status: 400 })

  try {
    const postId = await runDraft(tenantId, suggestionId)
    return NextResponse.json({ ok: true, postId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/clem/draft]', message)
    const { error, status } = aiErrorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
