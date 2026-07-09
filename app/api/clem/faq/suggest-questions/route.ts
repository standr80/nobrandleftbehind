import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { suggestFaqQuestions } from '@/lib/clem/faq'
import { resolveMutationWorkspace } from '@/lib/workspace/active'
import { aiErrorResponse } from '@/lib/anthropic'

export const maxDuration = 60

// POST — ask Clem to suggest candidate FAQ questions for a topic and add the
// new ones to the question bank. Used when Scout has no PAA to import.
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as { tenantId?: string; topic?: string; topicId?: string }
  const workspace = await resolveMutationWorkspace(userId, body.tenantId)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const topic = (body.topic ?? '').trim()
  if (!topic) return NextResponse.json({ error: 'A topic is required' }, { status: 400 })

  try {
    const added = await suggestFaqQuestions(workspace.tenantId, topic, body.topicId)
    return NextResponse.json({ ok: true, added: added.length, questions: added })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/clem/faq/suggest-questions]', message)
    const { error, status } = aiErrorResponse(err)
    return NextResponse.json({ error }, { status })
  }
}
